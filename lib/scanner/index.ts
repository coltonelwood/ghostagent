/**
 * scanner/index.ts — GhostAgent / Nexus AI Asset Scanner
 *
 * Architecture:
 *   detection-classes.ts  → all patterns, contextual rules, PHI signals
 *   learning-engine.ts    → feedback loop, suppression, boost weights
 *   index.ts (this file)  → GitHub API orchestration + GPT classification
 *
 * Adding new detections: edit detection-classes.ts only.
 * Tuning risk scoring: edit detection-classes.ts CONTEXTUAL_RULES.
 */

import { Octokit } from "@octokit/rest";
import OpenAI from "openai";
import { adminClient } from "@/lib/supabase/admin";
import { scanLogger } from "@/lib/logger";
import { withRetry, sleep } from "@/lib/retry";
import {
  ALL_PATTERNS,
  CONTENT_SIGNALS,
  CONTEXTUAL_RULES,
  PHI_ENV_SIGNALS,
  PROTOTYPE_PATH_SIGNALS,
  NON_AI_EXPERIMENT_EXCLUSIONS,
  FLAG_FILE_PATHS,
  AI_FLAG_NAME_PATTERN,
  resolveComplianceTags,
  resolveFallbackReason,
  isEducationalPath,
  looksLikeFrameworkRepo,
  type DetectionPattern,
  type DetectionClass,
} from "./detection-classes";
import {
  getSuppressedPatterns,
  getPatternBoosts,
  recordScanMetrics,
} from "./learning-engine";

// ─── CONFIG ───────────────────────────────────────────────────────────────
const MAX_REPOS_PER_SCAN = 10;
const TIME_LIMIT_MS = 4 * 60 * 1000; // 4 min — leaves 60s buffer for Vercel 300s

/**
 * Hard cap on how many findings we send to the GPT classifier in one scan.
 * Each call is ~$0.01–$0.02 and takes ~2s; a runaway scan could drain
 * spend budget or time out Vercel. Anything beyond this cap still gets
 * inserted but with a heuristic classification instead of an LLM one.
 */
const MAX_LLM_CLASSIFICATIONS_PER_SCAN = 60;

/**
 * Absolute ceiling on findings per scan. Protects against pattern
 * runaway on huge monorepos. Findings are ranked by tier + signal before
 * being truncated, so the best-signal ones always make the cut.
 */
const MAX_FINDINGS_PER_SCAN = 500;

/**
 * Per-repo cap. Prevents a single framework fork (e.g. a customer's
 * copy of langchain-ai/langchain) from dominating the scan summary.
 * Ranked + truncated during collection so the rest of the org still
 * gets attention.
 */
const MAX_FINDINGS_PER_REPO = 30;

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// ─── SERVICE DETECTION (what external services does this asset touch?) ────
const SERVICE_PATTERNS: Record<string, RegExp> = {
  stripe:    /stripe|Stripe/,
  sendgrid:  /sendgrid|SendGrid/,
  salesforce:/salesforce|sfdc/i,
  slack:     /slack\.com|SlackClient/i,
  twilio:    /twilio/i,
  hubspot:   /hubspot/i,
  postgres:  /postgres|pg\.|psycopg/i,
  mongodb:   /mongodb|MongoClient/i,
  redis:     /redis\.Redis|redisClient/i,
  aws:       /boto3|aws-sdk|@aws-sdk/,
  gmail:     /gmail|smtplib/i,
  notion:    /notion\.so|NotionClient/i,
  openai:    /openai|gpt-4|gpt-3/i,
  anthropic: /anthropic|claude/i,
  bedrock:   /bedrock|SageMaker/i,
  hubspot2:  /hubspot/i,
};

function extractServices(content: string): string[] {
  return Object.entries(SERVICE_PATTERNS)
    .filter(([, regex]) => regex.test(content))
    .map(([service]) => service);
}

function detectSecrets(content: string): boolean {
  return [
    /sk-[a-zA-Z0-9]{20,}/,
    /AKIA[0-9A-Z]{16}/,
    /ghp_[a-zA-Z0-9]{36}/,
    /xox[bps]-[a-zA-Z0-9-]+/,
    /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/,
  ].some((p) => p.test(content));
}

function isPrototypePath(filePath: string): boolean {
  if (!PROTOTYPE_PATH_SIGNALS.some((p) => p.test(filePath))) return false;
  if (NON_AI_EXPERIMENT_EXCLUSIONS.some((p) => p.test(filePath))) return false;
  return true;
}

function detectPhiContext(content: string): boolean {
  return PHI_ENV_SIGNALS.some((p) => p.test(content));
}

/** Scan inline content for known risk signals beyond the search pattern */
function analyzeContentSignals(content: string): {
  extraReasons: string[];
  signalScore: number; // 0-1, used to boost risk
} {
  const extraReasons: string[] = [];
  let signalScore = 0;

  for (const signal of CONTENT_SIGNALS) {
    if (signal.pattern.test(content)) {
      signalScore += signal.weight;
      // Only surface the highest-weight signals as reasons
      if (signal.weight >= 0.7) {
        extraReasons.push(signal.name.replace(/_/g, " "));
      }
    }
  }

  return { extraReasons, signalScore: Math.min(signalScore, 1) };
}

// ─── RISK FLOOR COMPUTATION ───────────────────────────────────────────────
function computeBaseRisk(agent: FoundAgent, pattern: DetectionPattern, boostMap: Map<string, number>): {
  floor: string;
  escalationReasons: string[];
} {
  const reasons: string[] = [];
  let level = "medium";

  // Framework-repo short-circuit: if the enclosing repo IS an AI
  // framework or curated collection, no finding from it represents an
  // operational AI system in the customer's stack. Cap at "low" and
  // explain why so the summary stays honest.
  if (agent.framework_repo) {
    reasons.push(
      agent.framework_reason
        ? `${agent.framework_reason} Findings here reflect library internals, not your organization's operational AI footprint.`
        : "This repository appears to be an AI framework or curated collection. Findings reflect the library itself, not your operational AI systems.",
    );
    return { floor: "low", escalationReasons: [...new Set(reasons)] };
  }

  // Educational-path short-circuit: a file under examples/, cookbook/,
  // tutorials/, docs/, or a .ipynb at any depth is documentation, not
  // production. Cap at "low" with a note.
  if (agent.is_educational) {
    reasons.push(
      "File is under an examples, docs, cookbook, tutorials, or notebooks path. Treated as educational content, not an operational AI system.",
    );
    return { floor: "low", escalationReasons: [...new Set(reasons)] };
  }

  // Apply pattern's own floor
  if (pattern.riskFloor) level = maxRisk(level, pattern.riskFloor);

  // Apply PHI-critical rule
  if (pattern.phiCritical && agent.phi_context) {
    level = "critical";
    reasons.push("AI/ML system in a PHI-related environment — verify whether patient data flows to third-party providers and whether a Business Associate Agreement is in place.");
  }

  // Apply all contextual rules
  for (const rule of CONTEXTUAL_RULES) {
    if (rule.condition({
      phi: agent.phi_context,
      isProto: agent.is_prototype,
      hasSecrets: agent.has_secrets,
      services: agent.services,
      agentType: agent.agent_type,
      daysSinceCommit: agent.days_since_commit,
    })) {
      level = maxRisk(level, rule.riskFloor);
      reasons.push(rule.reason);
    }
  }

  // Hardcoded secrets handling — critical only when we're confident this is
  // a real leak. Example files and prototypes don't count, and a lone regex
  // match shouldn't crown a finding CRITICAL on its own.
  if (agent.has_secrets && looksLikeRealSecret(agent)) {
    level = "critical";
    reasons.push(
      "Hardcoded credentials detected in AI system — rotate immediately and audit whether this secret has shipped to production.",
    );
  } else if (agent.has_secrets) {
    level = maxRisk(level, "high");
    reasons.push(
      "Secret-like token found in this file. Appears to be an example or test value — confirm it is not a real credential before ignoring.",
    );
  }

  // Inline content signals
  if (agent.signal_score > 0.7) {
    level = maxRisk(level, "high");
    reasons.push(...agent.extra_reasons);
  }

  // Pattern boost (from learning engine — high-precision patterns → elevate)
  if (boostMap.get(pattern.query) === 1.5 && level === "medium") {
    level = "high";
    reasons.push("Historically high-confidence detection pattern.");
  }

  return { floor: level, escalationReasons: [...new Set(reasons)] }; // dedupe
}

/**
 * Conservative heuristic for whether a regex-matched "secret" is likely a
 * real leaked credential instead of an example value in .env.example, a
 * test fixture, or a README snippet. False positives here are worse than
 * false negatives — we'd rather downgrade a real leak to HIGH than crown
 * a demo fixture as CRITICAL and lose the room.
 */
function looksLikeRealSecret(agent: FoundAgent): boolean {
  const p = agent.file_path.toLowerCase();
  // Example / template / fixture / docs paths — not real
  if (
    /\.env\.(example|sample|template)$/.test(p) ||
    /\.env\.local\.example$/.test(p) ||
    /\/(example|examples|fixtures?|docs?|test|tests|__mocks?__|spec)\//.test(p) ||
    /readme/.test(p) ||
    /\.md$/.test(p) ||
    /\.lock$/.test(p)
  ) {
    return false;
  }
  // Obviously placeholder values
  if (
    /example|placeholder|your.?api.?key|my.?secret|xxxx+|<.*>/i.test(
      agent.content.slice(0, 3000),
    )
  ) {
    return false;
  }
  return true;
}

function maxRisk(a: string, b: string): string {
  const order = ["low", "medium", "high", "critical"];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}

// ─── FOUND AGENT TYPE ─────────────────────────────────────────────────────
interface FoundAgent {
  name: string;
  repo: string;
  file_path: string;
  content: string;
  owner_github: string | null;
  owner_email: string | null;
  last_commit_at: string | null;
  days_since_commit: number | null;
  agent_type: string;
  detection_class: string;
  services: string[];
  has_secrets: boolean;
  is_prototype: boolean;
  is_educational: boolean;
  /** True if the enclosing repo is itself an AI framework/library/catalog. */
  framework_repo: boolean;
  /** Human-readable reason we decided the repo is a framework (for the UI). */
  framework_reason?: string;
  phi_context: boolean;
  signal_score: number;
  extra_reasons: string[];
  tier: number;
  pattern_query: string;
}

// ─── GPT CLASSIFICATION ───────────────────────────────────────────────────
async function classifyAgent(
  agent: FoundAgent,
  pattern: DetectionPattern,
  boostMap: Map<string, number>,
  opts: { skipLLM?: boolean } = {},
): Promise<{ risk_level: string; risk_reason: string; why_flagged: string; description: string; compliance_tags: string[]; confidence_score: number }> {
  const { floor, escalationReasons } = computeBaseRisk(agent, pattern, boostMap);

  // Budget-exhausted path: skip OpenAI entirely and use curated templates.
  if (opts.skipLLM) {
    const fb = resolveFallbackReason(
      agent.detection_class as DetectionClass,
      { name: agent.agent_type || agent.name, repo: agent.repo, file: agent.file_path },
      escalationReasons,
    );
    return {
      risk_level: floor,
      risk_reason: fb.riskReason,
      why_flagged: fb.whyFlagged,
      description: fb.description,
      compliance_tags: resolveComplianceTags(
        agent.detection_class as DetectionClass,
        agent.phi_context,
      ),
      confidence_score: tier1Confidence(agent, pattern),
    };
  }

  const escalationNote = escalationReasons.length > 0
    ? `\n\nPRE-COMPUTED RISK ESCALATIONS (enforce these — do not downgrade below "${floor}"):\n` +
      escalationReasons.map((r) => `• ${r}`).join("\n")
    : "";

  const ownerStatus = agent.owner_github
    ? (agent.days_since_commit !== null && agent.days_since_commit > 90)
      ? `${agent.owner_github} (last active ${agent.days_since_commit} days ago — may have left)`
      : agent.owner_github
    : "No owner found";

  const prompt = `You are a security and compliance analyst specializing in AI governance.
Classify this AI asset found in a GitHub organization.

Detection class: ${agent.detection_class}
Asset type: ${agent.agent_type}
File: ${agent.file_path}
Repository: ${agent.repo}
Owner: ${ownerStatus}
External services connected: ${agent.services.join(", ") || "none"}
Hardcoded secrets: ${agent.has_secrets}
Prototype/experiment code: ${agent.is_prototype}
PHI/HIPAA environment: ${agent.phi_context}
${escalationNote}

Code snippet (first 2000 chars):
${agent.content.slice(0, 2000)}

Respond ONLY in JSON:
{
  "risk_level": "critical" | "high" | "medium" | "low",
  "risk_reason": "ONE sentence — the single most actionable concern. Be specific: name the file, the owner, the potential risk area.",
  "why_flagged": "ONE sentence in plain English for a non-technical reader — what governance gap does this represent and why does it matter?",
  "description": "ONE sentence — what this AI system does",
  "compliance_tags": ["HIPAA" | "SOC2" | "EU_AI_ACT" | "ISO42001"] — include frameworks this finding is most relevant to review against,
  "confidence_score": 0-100 — how confident are you this is a real AI governance risk (not a false positive)?
}

Risk level rules (STRICT — never downgrade below "${floor}"):
- critical: secrets, LLM+PHI, unauth prototype with real data, autonomous decisions without human review, owner departed >180 days
- high: custom ML in production, clinical AI, owner dormant >90 days, multi-service agent
- medium: disabled AI flag, well-owned automation
- low: recently maintained, no PHI, clear ownership`;

  try {
    const response = await withRetry(
      () => getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 250,
      }),
      {
        label: `classify(${agent.name})`,
        maxAttempts: 3,
        baseDelayMs: 2000,
        shouldRetry: (err) => {
          const s = (err as { status?: number })?.status;
          return s === 429 || s === 503;
        },
      }
    );

    const result = JSON.parse(response.choices[0].message.content ?? "{}");

    // Enforce floor — GPT cannot downgrade past heuristic minimum
    const ORDER = ["low", "medium", "high", "critical"];
    const finalLevel = ORDER.indexOf(result.risk_level ?? "medium") >= ORDER.indexOf(floor)
      ? (result.risk_level ?? "medium")
      : floor;

    // Combine GPT reason with escalation reasons
    const allReasons = [result.risk_reason, ...escalationReasons]
      .filter(Boolean)
      .slice(0, 3) // max 3 reasons
      .join(" | ");

    const confidence = typeof result.confidence_score === "number"
      ? Math.min(100, Math.max(0, result.confidence_score))
      : tier1Confidence(agent, pattern);

    // Deterministic compliance tags (class floor + PHI + validated LLM tags)
    const complianceTags = resolveComplianceTags(
      agent.detection_class as DetectionClass,
      agent.phi_context,
      Array.isArray(result.compliance_tags) ? result.compliance_tags : [],
    );

    return {
      risk_level: finalLevel,
      risk_reason: allReasons.slice(0, 600),
      why_flagged: (result.why_flagged ?? result.risk_reason ?? "").slice(0, 400),
      description: result.description ?? `${agent.agent_type} detected`,
      compliance_tags: complianceTags,
      confidence_score: confidence,
    };
  } catch {
    // Curated fallback — never falls back to a generic "AI detected" string.
    const fb = resolveFallbackReason(
      agent.detection_class as DetectionClass,
      {
        name: agent.agent_type || agent.name,
        repo: agent.repo,
        file: agent.file_path,
      },
      escalationReasons,
    );
    return {
      risk_level: floor,
      risk_reason: fb.riskReason,
      why_flagged: fb.whyFlagged,
      description: fb.description,
      compliance_tags: resolveComplianceTags(
        agent.detection_class as DetectionClass,
        agent.phi_context,
      ),
      confidence_score: tier1Confidence(agent, pattern),
    };
  }
}

/**
 * Heuristic confidence without GPT. Tier 1-2 patterns are precise (SDK
 * imports, named clients, Octokit, etc.) and start high. Tier 3+ patterns
 * are broader (wandb, xgboost, generic ML library names) and start lower
 * unless we see PHI context, a prototype path, or strong content signals.
 * This keeps the "247 assets found" number credible instead of flooding
 * the UI with low-signal detections.
 */
function tier1Confidence(agent: FoundAgent, pattern: DetectionPattern): number {
  // Framework repo and educational paths are systematically low signal —
  // cap their confidence aggressively so real findings from operational
  // code always rank above them in the UI. A downstream filter drops
  // confidence < 35 unless risk is high/critical, and the
  // framework/educational short-circuit in computeBaseRisk forces risk
  // to "low" for these — so they're filtered out entirely most of the
  // time. This cap is defense-in-depth for the remaining edge cases.
  if (agent.framework_repo) return 30;
  if (agent.is_educational) return 35;

  const tier = pattern.tier ?? 3;
  let score: number;
  if (tier <= 2) {
    score = 92 - (tier - 1) * 6; // tier 1=92, tier 2=86
  } else {
    // Tier 3+ starts around 55 and only climbs with corroborating signals.
    score = 55;
  }
  if (agent.phi_context) score = Math.min(100, score + 12);
  if (agent.has_secrets) score = Math.min(100, score + 8);
  if (agent.is_prototype) score += 5;
  if (agent.signal_score > 0.5) score = Math.min(100, score + 8);
  if (agent.days_since_commit !== null && agent.days_since_commit > 180) {
    score = Math.min(100, score + 6);
  }
  return Math.max(30, Math.min(100, Math.round(score)));
}

// ─── MAIN SCAN ────────────────────────────────────────────────────────────
export async function runScan(scanId: string, workspaceId: string) {
  const { data: workspace } = await adminClient
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .single();

  if (!workspace?.github_token || !workspace?.github_org) {
    await adminClient.from("scans").update({ status: "failed", error_message: "GitHub not configured" }).eq("id", scanId);
    return;
  }

  const octokit = new Octokit({ auth: workspace.github_token, request: { timeout: 30_000 } });
  scanLogger.info({ scanId, workspaceId, org: workspace.github_org }, "scan: starting");
  await adminClient.from("scans").update({ status: "scanning" }).eq("id", scanId);

  const scanStart = Date.now();

  // Load learning engine data in parallel
  const [suppressedPatterns, boostMap] = await Promise.all([
    getSuppressedPatterns(),
    getPatternBoosts(),
  ]);

  // Filter out suppressed patterns
  const activePatterns = ALL_PATTERNS.filter(p => !suppressedPatterns.has(p.query));

  scanLogger.info({
    scanId,
    totalPatterns: ALL_PATTERNS.length,
    activePatterns: activePatterns.length,
    suppressed: suppressedPatterns.size,
  }, "scan: patterns loaded");

  try {
    const repos = await withRetry(
      () => octokit.paginate(octokit.repos.listForOrg, {
        org: workspace.github_org,
        per_page: 100,
        type: "all",
        sort: "pushed",
        direction: "desc",
      }),
      { label: `listForOrg(${workspace.github_org})`, maxAttempts: 3 }
    );

    const targetRepos = repos.slice(0, MAX_REPOS_PER_SCAN);

    scanLogger.info({
      scanId,
      totalRepos: repos.length,
      scanning: targetRepos.length,
    }, "scan: repos fetched");

    const foundAgents: FoundAgent[] = [];
    let reposScanned = 0;

    // ── PRE-SCAN: env files + feature flag files (no rate limit cost) ─────
    for (const repo of targetRepos.slice(0, 3)) {
      // Scan .env.example for ML service env vars, API keys, PHI signals
      await scanEnvFile(repo, workspace.github_org, octokit, foundAgents);

      // Scan feature flag JSON files for AI-related flags
      await scanFlagFiles(repo, workspace.github_org, octokit, foundAgents);
    }

    // ── MAIN SCAN LOOP ────────────────────────────────────────────────────
    for (const repo of targetRepos) {
      if (Date.now() - scanStart > TIME_LIMIT_MS) {
        scanLogger.warn({ scanId, reposScanned }, "scan: time limit reached");
        break;
      }

      reposScanned++;

      if (reposScanned % 3 === 0) {
        await adminClient.from("scans").update({ repos_scanned: reposScanned }).eq("id", scanId);
      }

      // Detect PHI context from env file cached above
      const repoPhiContext = foundAgents.some(a => a.repo === repo.full_name && a.phi_context);

      // Detect whether this repo IS an AI framework / library / catalog.
      // When it is, we still scan it (so the user sees the signal exists)
      // but every finding gets flagged and severity-capped at "low" so
      // framework internals don't drown real operational AI findings.
      const frameworkCheck = looksLikeFrameworkRepo(
        repo as {
          name?: string;
          full_name?: string;
          description?: string | null;
          topics?: string[] | null;
        },
      );
      if (frameworkCheck.isFramework) {
        scanLogger.info(
          { scanId, repo: repo.full_name, reason: frameworkCheck.reason },
          "scan: repo detected as AI framework — findings will be dampened",
        );
      }

      // Per-repo cap — stop scanning new patterns once a single repo
      // reaches the ceiling. Prevents a customer's fork of langchain/
      // langchain from burning through the global finding budget.
      const repoAgentCount = () =>
        foundAgents.filter((a) => a.repo === repo.full_name).length;

      for (const pattern of activePatterns) {
        if (Date.now() - scanStart > TIME_LIMIT_MS) break;
        if (repoAgentCount() >= MAX_FINDINGS_PER_REPO) {
          scanLogger.info(
            { scanId, repo: repo.full_name, cap: MAX_FINDINGS_PER_REPO },
            "scan: per-repo finding cap reached — moving on",
          );
          break;
        }

        await sleep(2000); // GitHub search rate limit: 30 req/min

        try {
          const searchResult = await withRetry(
            () => octokit.search.code({
              q: `${pattern.query} repo:${repo.full_name}`,
              per_page: 10,
            }),
            {
              label: `search(${pattern.query} in ${repo.full_name})`,
              maxAttempts: 3,
              baseDelayMs: 5000,
              shouldRetry: (err) => {
                const s = (err as { status?: number })?.status;
                return s === 429 || s === 503 || s === 504 ||
                  String(err).includes("secondary rate limit");
              },
            }
          );

          for (const item of searchResult.data.items) {
            // Skip noise
            if (["node_modules", "vendor", ".lock", "package-lock", ".min."].some(s => item.path.includes(s))) continue;
            // Per-repo cap reached mid-page — drop the rest
            if (repoAgentCount() >= MAX_FINDINGS_PER_REPO) break;
            // Skip duplicates (same file already found by another pattern)
            if (foundAgents.some(a => a.repo === repo.full_name && a.file_path === item.path)) continue;

            try {
              const fileContent = await octokit.repos.getContent({
                owner: workspace.github_org,
                repo: repo.name,
                path: item.path,
              });

              if (!("content" in fileContent.data && fileContent.data.content)) continue;
              if ((fileContent.data as { encoding?: string }).encoding !== "base64") continue;

              let content: string;
              try { content = Buffer.from(fileContent.data.content, "base64").toString("utf-8"); }
              catch { continue; }
              if (content.length > 500_000) continue;

              const commits = await octokit.repos.listCommits({
                owner: workspace.github_org,
                repo: repo.name,
                path: item.path,
                per_page: 1,
              });

              const lastCommit = commits.data[0];
              const lastCommitDate = lastCommit?.commit?.author?.date ?? null;
              const daysSince = lastCommitDate
                ? Math.floor((Date.now() - new Date(lastCommitDate).getTime()) / 86400000)
                : null;

              const { extraReasons, signalScore } = analyzeContentSignals(content);

              foundAgents.push({
                name: item.name,
                repo: repo.full_name,
                file_path: item.path,
                content,
                owner_github: lastCommit?.author?.login ?? null,
                owner_email: lastCommit?.commit?.author?.email ?? null,
                last_commit_at: lastCommitDate,
                days_since_commit: daysSince,
                agent_type: pattern.label,
                detection_class: pattern.class,
                services: extractServices(content),
                has_secrets: detectSecrets(content),
                is_prototype: isPrototypePath(item.path),
                is_educational: isEducationalPath(item.path),
                framework_repo: frameworkCheck.isFramework,
                framework_reason: frameworkCheck.reason,
                phi_context: repoPhiContext || detectPhiContext(content),
                signal_score: signalScore,
                extra_reasons: extraReasons,
                tier: pattern.tier,
                pattern_query: pattern.query,
              });
            } catch {
              // Skip unreadable files silently
            }
          }
        } catch (err) {
          scanLogger.warn({ scanId, repo: repo.full_name, pattern: pattern.query, err: String(err) }, "scan: search error");
        }
      }
    }

    // Rank best-signal findings first so if we have to truncate we keep
    // the ones most likely to matter.
    foundAgents.sort((a, b) => {
      const ap = a.phi_context ? 1 : 0;
      const bp = b.phi_context ? 1 : 0;
      if (ap !== bp) return bp - ap; // PHI first
      if (a.tier !== b.tier) return a.tier - b.tier; // lower tier = higher precision
      return b.signal_score - a.signal_score;
    });

    // Absolute ceiling on findings. Anything beyond this is dropped with
    // a log so we know it happened.
    let truncatedBeyondCeiling = 0;
    if (foundAgents.length > MAX_FINDINGS_PER_SCAN) {
      truncatedBeyondCeiling = foundAgents.length - MAX_FINDINGS_PER_SCAN;
      foundAgents.length = MAX_FINDINGS_PER_SCAN;
      scanLogger.warn(
        { scanId, truncatedBeyondCeiling, kept: MAX_FINDINGS_PER_SCAN },
        "scan: finding count exceeded ceiling — truncating",
      );
    }

    scanLogger.info(
      { scanId, foundAgents: foundAgents.length, reposScanned, truncatedBeyondCeiling },
      "scan: classifying",
    );

    await adminClient.from("scans").update({
      status: "classifying",
      repos_scanned: reposScanned,
      agents_found: foundAgents.length,
    }).eq("id", scanId);

    // ── CLASSIFY ──────────────────────────────────────────────────────────
    const byClass: Record<string, number> = {};
    const byRisk: Record<string, number> = {};
    let llmCallsUsed = 0;

    for (const agent of foundAgents) {
      const pattern = ALL_PATTERNS.find(p => p.query === agent.pattern_query)
        ?? ALL_PATTERNS.find(p => p.label === agent.agent_type)
        ?? { query: agent.pattern_query, label: agent.agent_type, class: agent.detection_class as never, tier: agent.tier };

      // Budget guard: cap LLM calls per scan. Once the cap is hit, every
      // remaining finding gets the curated fallback classification — no
      // new OpenAI spend. Users still see professional copy because
      // classifyAgent's fallback path is template-driven.
      const llmBudgetExhausted = llmCallsUsed >= MAX_LLM_CLASSIFICATIONS_PER_SCAN;
      const classification = await classifyAgent(
        agent,
        pattern,
        boostMap,
        { skipLLM: llmBudgetExhausted },
      );
      if (!llmBudgetExhausted) llmCallsUsed++;

      // Drop very-low-signal findings that didn't escalate to high/critical.
      // A tier-4 match on `xgboost` with no PHI, no secrets, no stale owner,
      // and confidence < 35 is noise we shouldn't confuse the user with.
      if (
        classification.confidence_score < 35 &&
        classification.risk_level !== "critical" &&
        classification.risk_level !== "high"
      ) {
        scanLogger.info(
          {
            scanId,
            file: agent.file_path,
            confidence: classification.confidence_score,
          },
          "scan: dropping low-confidence finding",
        );
        continue;
      }

      // Track metrics
      byClass[agent.detection_class] = (byClass[agent.detection_class] ?? 0) + 1;
      byRisk[classification.risk_level] = (byRisk[classification.risk_level] ?? 0) + 1;

      const insert = {
        scan_id: scanId,
        workspace_id: workspaceId,
        name: agent.name,
        repo: agent.repo,
        file_path: agent.file_path,
        owner_github: agent.owner_github,
        owner_email: agent.owner_email,
        last_commit_at: agent.last_commit_at,
        days_since_commit: agent.days_since_commit,
        agent_type: agent.agent_type,
        detection_class: agent.detection_class,
        description: classification.description,
        risk_level: classification.risk_level,
        risk_reason: classification.risk_reason,
        why_flagged: classification.why_flagged,
        confidence_score: classification.confidence_score,
        compliance_tags: classification.compliance_tags,
        services: agent.services,
        has_secrets: agent.has_secrets,
      };

      await withRetry(
        async () => {
          const r = await adminClient.from("agents").upsert(insert, {
            onConflict: "scan_id,repo,file_path",
            ignoreDuplicates: true,
          });
          if (r.error) throw r.error;
        },
        { label: "agents.upsert", maxAttempts: 3 }
      );
    }

    // ── RECORD SCAN METRICS ───────────────────────────────────────────────
    await recordScanMetrics({
      orgId: workspace.owner_id,
      scanId,
      totalFound: foundAgents.length,
      byClass,
      byRisk,
    });

    scanLogger.info({ scanId, workspaceId, agentsFound: foundAgents.length }, "scan: completed");

    await adminClient.from("scans").update({
      status: "completed",
      repos_scanned: reposScanned,
      agents_found: foundAgents.length,
      completed_at: new Date().toISOString(),
    }).eq("id", scanId);

    await adminClient
      .from("workspaces")
      .update({ scan_count: (workspace.scan_count ?? 0) + 1 })
      .eq("id", workspaceId);

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    scanLogger.error({ scanId, workspaceId, message, stack }, "scan: failed");
    await adminClient.from("scans").update({ status: "failed", error_message: message }).eq("id", scanId);
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────

async function scanEnvFile(
  repo: { full_name: string; name: string },
  org: string,
  octokit: Octokit,
  foundAgents: FoundAgent[],
): Promise<void> {
  for (const envPath of [".env.example", ".env.sample", ".env.template"]) {
    try {
      const envFile = await octokit.repos.getContent({ owner: org, repo: repo.name, path: envPath });
      if (!("content" in envFile.data && envFile.data.content)) continue;

      const content = Buffer.from(envFile.data.content, "base64").toString("utf-8");
      const isPhi = detectPhiContext(content);
      const { extraReasons, signalScore } = analyzeContentSignals(content);

      // OpenAI API key
      if (/OPENAI_API_KEY/i.test(content)) {
        foundAgents.push(makeEnvAsset(repo.full_name, envPath, "OpenAI", "LLM_INTEGRATION", content, isPhi, extraReasons, signalScore, "openai.chat.completions"));
      }
      // Anthropic key
      if (/ANTHROPIC_API_KEY/i.test(content)) {
        foundAgents.push(makeEnvAsset(repo.full_name, envPath, "Anthropic Claude", "LLM_INTEGRATION", content, isPhi, extraReasons, signalScore, "import anthropic"));
      }
      // Custom ML service
      if (/ML_SCORING_SERVICE_URL|ML_MODEL_VERSION/i.test(content)) {
        foundAgents.push(makeEnvAsset(repo.full_name, envPath, "ML Scoring Service", "ML_SERVICE", content, isPhi, extraReasons, signalScore, "ML_SCORING_SERVICE_URL"));
      }
      // AI feature flags
      const aiFlags = content.match(/FF_AI_[A-Z_]+=\w+/gi) ?? [];
      for (const flag of aiFlags) {
        foundAgents.push(makeEnvAsset(repo.full_name, envPath, "AI Feature Flag", "AI_FEATURE_FLAG",
          `Flag: ${flag}\n\nContext:\n${content.slice(0, 1000)}`, isPhi, [], 0, "FF_AI_"));
      }

      break; // Found an env file, stop checking alternatives
    } catch {
      // No env file at this path
    }
  }
}

async function scanFlagFiles(
  repo: { full_name: string; name: string },
  org: string,
  octokit: Octokit,
  foundAgents: FoundAgent[],
): Promise<void> {
  const isPhi = foundAgents.some(a => a.repo === repo.full_name && a.phi_context);

  for (const flagPath of FLAG_FILE_PATHS) {
    try {
      const flagFile = await octokit.repos.getContent({ owner: org, repo: repo.name, path: flagPath });
      if (!("content" in flagFile.data && flagFile.data.content)) continue;

      const content = Buffer.from(flagFile.data.content, "base64").toString("utf-8");

      // Parse and find AI-related flag names
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(content); } catch { continue; }

      // Handle both { flags: { ... } } and flat { flagName: { ... } } structures
      const flagsObj = (parsed.flags ?? parsed) as Record<string, unknown>;

      for (const [flagName, flagDef] of Object.entries(flagsObj)) {
        if (!AI_FLAG_NAME_PATTERN.test(flagName)) continue;
        if (typeof flagDef !== "object" || flagDef === null) continue;

        const def = flagDef as Record<string, unknown>;
        const notes = String(def.notes ?? "");
        const enabled = Boolean(def.enabled);
        const rollout = Number(def.rolloutPercentage ?? 0);

        foundAgents.push({
          name: flagName,
          repo: repo.full_name,
          file_path: flagPath,
          content: `AI feature flag: "${flagName}"\nEnabled: ${enabled}\nRollout: ${rollout}%\nNotes: ${notes}\n\nFull config:\n${content.slice(0, 1500)}`,
          owner_github: null,
          owner_email: null,
          last_commit_at: null,
          days_since_commit: null,
          agent_type: enabled && rollout > 0 ? "Active AI System" : "AI Feature Flag",
          detection_class: "AI_FEATURE_FLAG",
          services: [],
          has_secrets: false,
          is_prototype: flagPath.startsWith("experiments/"),
          is_educational: isEducationalPath(flagPath),
          framework_repo: false,
          phi_context: isPhi,
          signal_score: enabled && rollout > 0 ? 0.7 : 0.3,
          extra_reasons: enabled && rollout > 0 ? [`active at ${rollout}% rollout`] : ["disabled — dormant AI system"],
          tier: 3,
          pattern_query: "FF_AI_",
        });
      }

      break;
    } catch {
      // No flag file at this path
    }
  }
}

function makeEnvAsset(
  repoFullName: string,
  filePath: string,
  agentType: string,
  detectionClass: string,
  content: string,
  phiContext: boolean,
  extraReasons: string[],
  signalScore: number,
  patternQuery: string,
): FoundAgent {
  return {
    name: filePath,
    repo: repoFullName,
    file_path: filePath,
    content: content.slice(0, 2000),
    owner_github: null,
    owner_email: null,
    last_commit_at: null,
    days_since_commit: null,
    agent_type: agentType,
    detection_class: detectionClass,
    services: extractServices(content),
    has_secrets: detectSecrets(content),
    is_prototype: false,
    is_educational: isEducationalPath(filePath),
    framework_repo: false,
    phi_context: phiContext,
    signal_score: signalScore,
    extra_reasons: extraReasons,
    tier: 2,
    pattern_query: patternQuery,
  };
}
