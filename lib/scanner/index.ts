import { Octokit } from "@octokit/rest";
import OpenAI from "openai";
import { adminClient } from "@/lib/supabase/admin";
import { scanLogger } from "@/lib/logger";
import { withRetry, sleep } from "@/lib/retry";

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const MAX_REPOS_PER_SCAN = 10;

// ─── DETECTION PATTERNS ───────────────────────────────────────────────────
// Tier 1: Direct LLM/agent framework usage
const AGENT_PATTERNS = [
  { query: "langchain",                      label: "LangChain",       tier: 1 },
  { query: "ChatOpenAI",                     label: "LangChain",       tier: 1 },
  { query: "openai.chat.completions",        label: "OpenAI",          tier: 1 },
  { query: "anthropic",                      label: "Anthropic",       tier: 1 },
  { query: "crewai",                         label: "CrewAI",          tier: 1 },
  { query: "AgentExecutor",                  label: "LangChain",       tier: 1 },
  // Tier 2: Custom ML services
  { query: "ML_SCORING_SERVICE_URL",         label: "ML Service",      tier: 2 },
  { query: "ML_MODEL_VERSION",               label: "ML Service",      tier: 2 },
  { query: "ML_CONFIDENCE_THRESHOLD",        label: "ML Service",      tier: 2 },
  { query: "inference_endpoint",             label: "ML Service",      tier: 2 },
  { query: "model_version",                  label: "ML Service",      tier: 2 },
  { query: "scoring_service",                label: "ML Service",      tier: 2 },
  // Tier 3: AI feature flags
  { query: "FF_AI_",                         label: "AI Feature Flag", tier: 3 },
  { query: "enable_ai",                      label: "AI Feature Flag", tier: 3 },
  { query: "ai_enabled",                     label: "AI Feature Flag", tier: 3 },
  { query: "ai_review",                      label: "AI Feature Flag", tier: 3 },
  // Tier 4: Document AI / OCR
  { query: "textract",                       label: "Document AI",     tier: 4 },
  { query: "ocr_process",                    label: "Document AI",     tier: 4 },
  { query: "document_intelligence",          label: "Document AI",     tier: 4 },
  { query: "vision_api",                     label: "Document AI",     tier: 4 },
  // Tier 5: Anomaly / ML detection scripts
  { query: "anomaly_detection",              label: "ML Agent",        tier: 5 },
  { query: "ANOMALY_THRESHOLD",              label: "ML Agent",        tier: 5 },
  { query: "fraud_model",                    label: "ML Agent",        tier: 5 },
  { query: "claims-fraud",                   label: "ML Agent",        tier: 5 },
  // Tier 6: Python ML models (requirements.txt / model files)
  { query: "transformers torch",             label: "ML Model",        tier: 6 },
  { query: "Bio_ClinicalBERT",              label: "Clinical NLP",    tier: 6 },
  { query: "mlflow",                         label: "ML Model",        tier: 6 },
  { query: "readmission",                    label: "Clinical ML",     tier: 6 },
  { query: "patient_similarity",             label: "Clinical ML",     tier: 6 },
  { query: "model.predict",                  label: "ML Model",        tier: 6 },
  { query: "torch.load",                     label: "ML Model",        tier: 6 },
  { query: "SentenceTransformer",            label: "Embeddings",      tier: 6 },
  { query: "openai.embeddings",              label: "Embeddings",      tier: 1 },
  { query: "text-embedding-ada",             label: "Embeddings",      tier: 1 },
  // Tier 7: JSON feature flag files with AI flags
  { query: "ai-coding-suggestions",          label: "AI Feature Flag", tier: 3 },
  { query: "ai_claim_review",                label: "AI Feature Flag", tier: 3 },
  { query: "enable_ai_suggestions",          label: "AI Feature Flag", tier: 3 },
];

const SERVICE_PATTERNS: Record<string, RegExp> = {
  stripe: /stripe|Stripe/,
  sendgrid: /sendgrid|SendGrid/,
  salesforce: /salesforce|sfdc/i,
  slack: /slack\.com|SlackClient/i,
  twilio: /twilio/i,
  hubspot: /hubspot/i,
  postgres: /postgres|pg\.|psycopg/i,
  mongodb: /mongodb|MongoClient/i,
  redis: /redis\.Redis|redisClient/i,
  aws: /boto3|aws-sdk|@aws-sdk/,
  gmail: /gmail|smtplib/i,
  notion: /notion\.so|NotionClient/i,
  openai: /openai|gpt-4|gpt-3/i,
  anthropic: /anthropic|claude/i,
  bedrock: /bedrock|SageMaker/i,
};

// ─── PHI ENVIRONMENT SIGNALS ─────────────────────────────────────────────
// If any of these exist in the repo env/config, the repo handles PHI
const PHI_ENV_SIGNALS = [
  /HIPAA/i,
  /hipaa_audit/i,
  /phi_/i,
  /hl7|fhir/i,
  /epic_client|cerner_client|athena_client/i,
  /ENCRYPTION_AT_REST/i,
  /mrn|medical.record/i,
];

// ─── PROTOTYPE / EXPERIMENT SIGNALS ──────────────────────────────────────
const PROTOTYPE_PATH_SIGNALS = [
  /^experiments\//i,
  /^prototype/i,
  /\/proto\//i,
  /\/spike\//i,
  /\/poc\//i,
  /-prototype/i,
  /-experimental/i,
];

function extractServices(content: string): string[] {
  return Object.entries(SERVICE_PATTERNS)
    .filter(([, regex]) => regex.test(content))
    .map(([service]) => service);
}

function detectSecrets(content: string): boolean {
  const patterns = [
    /sk-[a-zA-Z0-9]{20,}/,
    /AKIA[0-9A-Z]{16}/,
    /ghp_[a-zA-Z0-9]{36}/,
    /xox[bps]-[a-zA-Z0-9-]+/,
    /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/,
  ];
  return patterns.some((p) => p.test(content));
}

// Paths that are experiments/prototypes but NOT AI-related
const NON_AI_EXPERIMENT_SIGNALS = [
  /\/perf-benchmarks\//i,
  /\/ab-tests\//i,
  /\/load-test/i,
  /\/benchmark/i,
  /\/feature-flags\/(?!.*ai)/i, // feature flags that don't mention AI
];

function isPrototypePath(filePath: string): boolean {
  // Must match a prototype signal
  if (!PROTOTYPE_PATH_SIGNALS.some((p) => p.test(filePath))) return false;
  // Must NOT be a generic non-AI experiment (perf benchmarks, A/B tests, etc.)
  // Exception: if the content itself has AI keywords, the caller should still flag it
  if (NON_AI_EXPERIMENT_SIGNALS.some((p) => p.test(filePath))) return false;
  return true;
}

function detectsPhiContext(content: string): boolean {
  return PHI_ENV_SIGNALS.some((p) => p.test(content));
}

/**
 * Compute a base risk score BEFORE GPT classification.
 * GPT can override, but this ensures the heuristic fallback is strong.
 */
function computeBaseRisk(agent: FoundAgent): {
  floor: string;
  escalationReasons: string[];
} {
  const reasons: string[] = [];
  let level = "medium";

  // Secrets → always critical
  if (agent.has_secrets) {
    level = "critical";
    reasons.push("hardcoded secrets detected");
  }

  // LLM + PHI environment = critical
  if (
    (agent.agent_type === "OpenAI" || agent.agent_type === "Anthropic" ||
     agent.agent_type === "LangChain" || agent.agent_type === "ML Service" ||
     agent.services.includes("openai") || agent.services.includes("anthropic")) &&
    agent.phi_context
  ) {
    level = "critical";
    reasons.push("LLM integration in HIPAA/PHI environment — potential data compliance violation");
  }

  // Prototype path → minimum high
  if (agent.is_prototype) {
    if (level !== "critical") level = "high";
    reasons.push("prototype/experiment code in production repo — likely no owner or governance");
  }

  // ML service (internal scoring endpoint) → high
  if (agent.agent_type === "ML Service") {
    if (level !== "critical") level = "high";
    reasons.push("custom ML scoring service — verify owner and data access scope");
  }

  // AI feature flag → medium minimum, flag as dormant AI risk
  if (agent.agent_type === "AI Feature Flag") {
    reasons.push("disabled AI system exists in codebase — no documented owner or activation criteria");
  }

  // Long dormancy escalations
  if (agent.days_since_commit !== null) {
    if (agent.days_since_commit > 180 && level !== "critical") {
      level = "critical";
      reasons.push(`owner gone ${agent.days_since_commit} days — system likely orphaned`);
    } else if (agent.days_since_commit > 90 && level === "medium") {
      level = "high";
      reasons.push(`no commits in ${agent.days_since_commit} days — likely unowned`);
    }
  }

  // Many external services → elevate
  if (agent.services.length >= 3 && level === "medium") {
    level = "high";
    reasons.push(`connects to ${agent.services.length} external services`);
  }

  return { floor: level, escalationReasons: reasons };
}

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
  services: string[];
  has_secrets: boolean;
  is_prototype: boolean;
  phi_context: boolean;
  tier: number;
}

async function classifyAgent(
  agent: FoundAgent
): Promise<{ risk_level: string; risk_reason: string; description: string }> {
  const { floor, escalationReasons } = computeBaseRisk(agent);

  const escalationNote = escalationReasons.length > 0
    ? `\n\nPRE-COMPUTED ESCALATIONS (must honor these — do not downgrade below "${floor}"):\n` +
      escalationReasons.map((r) => `- ${r}`).join("\n")
    : "";

  const prompt = `You are a security analyst. Classify this AI asset found in a GitHub organization.

Asset file: ${agent.file_path}
Repository: ${agent.repo}
Asset type: ${agent.agent_type}
Last commit by: ${agent.owner_github ?? "unknown"}
Days since last commit: ${agent.days_since_commit ?? "unknown"}
Connected services: ${agent.services.join(", ") || "none detected"}
Contains hardcoded secrets: ${agent.has_secrets}
In prototype/experiment directory: ${agent.is_prototype}
PHI/HIPAA environment signals: ${agent.phi_context}
${escalationNote}

Code snippet (first 2000 chars):
${agent.content.slice(0, 2000)}

Respond in JSON with:
- risk_level: "critical" | "high" | "medium" | "low"
- risk_reason: one sentence explaining the primary risk
- description: one sentence describing what this asset does

Rules:
- critical: secrets present, LLM+PHI environment, owner gone >180 days, prototype with no auth
- high: connects to external services + owner gone >90 days, custom ML service, unreviewed prototype
- medium: runs autonomously, owner gone >30 days, AI feature flag (dormant)
- low: simple scripts, recently maintained, well-documented owner
- Never downgrade below the pre-computed floor: "${floor}"`;

  try {
    const response = await withRetry(
      () => getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 200,
      }),
      {
        label: `classify(${agent.name})`,
        maxAttempts: 3,
        baseDelayMs: 2000,
        shouldRetry: (err) => {
          const status = (err as { status?: number })?.status;
          return status === 429 || status === 503;
        },
      }
    );

    const result = JSON.parse(response.choices[0].message.content ?? "{}");

    // Enforce floor — GPT cannot downgrade past heuristic minimum
    const RISK_ORDER = ["low", "medium", "high", "critical"];
    const resultLevel = result.risk_level ?? floor;
    const finalLevel =
      RISK_ORDER.indexOf(resultLevel) >= RISK_ORDER.indexOf(floor)
        ? resultLevel
        : floor;

    const allReasons = [result.risk_reason, ...escalationReasons].filter(Boolean).join("; ");

    return {
      risk_level: finalLevel,
      risk_reason: allReasons.slice(0, 500),
      description: result.description ?? "AI asset detected",
    };
  } catch {
    // Heuristic fallback — never fail the scan because GPT is down
    return {
      risk_level: floor,
      risk_reason: escalationReasons.join("; ") || "Classified by heuristic (AI unavailable)",
      description: `${agent.agent_type} in ${agent.repo}`,
    };
  }
}

export async function runScan(scanId: string, workspaceId: string) {
  const { data: workspace } = await adminClient
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .single();

  if (!workspace?.github_token || !workspace?.github_org) {
    await adminClient
      .from("scans")
      .update({ status: "failed", error_message: "GitHub not configured" })
      .eq("id", scanId);
    return;
  }

  const octokit = new Octokit({
    auth: workspace.github_token,
    request: { timeout: 30_000 },
  });

  scanLogger.info({ scanId, workspaceId, org: workspace.github_org }, "scan: starting");

  await adminClient.from("scans").update({ status: "scanning" }).eq("id", scanId);

  const scanStart = Date.now();
  const TIME_LIMIT_MS = 4 * 60 * 1000;

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

    // Fetch .env.example / .env.example.* from the org's repos to detect
    // PHI context and ML service env vars — single search, not per-pattern
    const envFileCache: Record<string, string> = {};
    for (const repo of targetRepos.slice(0, 3)) {
      try {
        const envFile = await octokit.repos.getContent({
          owner: workspace.github_org,
          repo: repo.name,
          path: ".env.example",
        });
        if ("content" in envFile.data && envFile.data.content) {
          const content = Buffer.from(envFile.data.content, "base64").toString("utf-8");
          envFileCache[repo.full_name] = content;

          // Check for ML service env vars directly
          if (
            /ML_SCORING_SERVICE_URL|ML_MODEL_VERSION|ML_CONFIDENCE_THRESHOLD/i.test(content) ||
            /OPENAI_API_KEY|ANTHROPIC_API_KEY|FF_AI_/i.test(content)
          ) {
            const isPhiRepo = detectsPhiContext(content);
            const hasOpenAI = /OPENAI_API_KEY/i.test(content);
            const hasMlService = /ML_SCORING_SERVICE_URL/i.test(content);
            const hasAIFlag = /FF_AI_[A-Z_]+=false/i.test(content);

            if (hasOpenAI || hasMlService) {
              foundAgents.push({
                name: ".env.example",
                repo: repo.full_name,
                file_path: ".env.example",
                content: content.slice(0, 2000),
                owner_github: null,
                owner_email: null,
                last_commit_at: null,
                days_since_commit: null,
                agent_type: hasMlService ? "ML Service" : "OpenAI",
                services: extractServices(content),
                has_secrets: detectSecrets(content),
                is_prototype: false,
                phi_context: isPhiRepo,
                tier: hasMlService ? 2 : 1,
              });
            }

            if (hasAIFlag) {
              // Extract which flags
              const flagMatches = content.match(/FF_AI_[A-Z_]+=\w+/gi) ?? [];
              for (const flag of flagMatches) {
                foundAgents.push({
                  name: flag,
                  repo: repo.full_name,
                  file_path: ".env.example",
                  content: `Feature flag: ${flag}\n\nFull env context:\n${content.slice(0, 1000)}`,
                  owner_github: null,
                  owner_email: null,
                  last_commit_at: null,
                  days_since_commit: null,
                  agent_type: "AI Feature Flag",
                  services: [],
                  has_secrets: false,
                  is_prototype: false,
                  phi_context: isPhiRepo,
                  tier: 3,
                });
              }
            }
          }
        }
      } catch {
        // No .env.example in this repo — fine
      }

      // Also scan feature flag JSON files for AI-related flags
      const flagFilePaths = [
        "experiments/feature-flags/flag-config.json",
        "config/feature-flags/flags.json",
        "feature-flags.json",
        "flags.json",
      ];
      for (const flagPath of flagFilePaths) {
        try {
          const flagFile = await octokit.repos.getContent({
            owner: workspace.github_org,
            repo: repo.name,
            path: flagPath,
          });
          if ("content" in flagFile.data && flagFile.data.content) {
            const content = Buffer.from(flagFile.data.content, "base64").toString("utf-8");
            // Look for AI-related flags by name
            const aiFlags = content.match(/"(ai[-_][^"]+|[^"]*[-_]ai[^"]*|[^"]*llm[^"]*|[^"]*ml[-_][^"]*)"/gi) ?? [];
            for (const flagMatch of aiFlags) {
              const flagName = flagMatch.replace(/"/g, "");
              // Skip non-flag JSON keys (description, notes, etc.)
              if (["description", "notes", "type", "seed", "property", "operator", "value"].includes(flagName)) continue;
              foundAgents.push({
                name: flagName,
                repo: repo.full_name,
                file_path: flagPath,
                content: `AI feature flag: "${flagName}"\n\nFull flag config:\n${content.slice(0, 2000)}`,
                owner_github: null,
                owner_email: null,
                last_commit_at: null,
                days_since_commit: null,
                agent_type: "AI Feature Flag",
                services: [],
                has_secrets: false,
                is_prototype: flagPath.startsWith("experiments/"),
                phi_context: envFileCache[repo.full_name] ? detectsPhiContext(envFileCache[repo.full_name]) : false,
                tier: 3,
              });
            }
          }
        } catch {
          // Flag file doesn't exist in this repo
        }
      }
    }

    for (const repo of targetRepos) {
      if (Date.now() - scanStart > TIME_LIMIT_MS) {
        scanLogger.warn({ scanId, reposScanned }, "scan: time limit reached");
        break;
      }

      reposScanned++;

      if (reposScanned % 3 === 0) {
        await adminClient
          .from("scans")
          .update({ repos_scanned: reposScanned })
          .eq("id", scanId);
      }

      const repoPhiContext = envFileCache[repo.full_name]
        ? detectsPhiContext(envFileCache[repo.full_name])
        : false;

      for (const pattern of AGENT_PATTERNS) {
        if (Date.now() - scanStart > TIME_LIMIT_MS) break;

        await sleep(2000);

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
                const status = (err as { status?: number })?.status;
                return status === 429 || status === 503 || status === 504 ||
                  String(err).includes("secondary rate limit");
              },
            }
          );

          for (const item of searchResult.data.items) {
            if (
              item.path.includes("node_modules") ||
              item.path.includes("vendor") ||
              item.path.includes(".lock") ||
              item.path.includes("package-lock") ||
              item.path.includes(".min.")
            ) continue;

            if (foundAgents.some((a) => a.repo === repo.full_name && a.file_path === item.path)) {
              continue;
            }

            try {
              const fileContent = await octokit.repos.getContent({
                owner: workspace.github_org,
                repo: repo.name,
                path: item.path,
              });

              if ("content" in fileContent.data && fileContent.data.content) {
                const encoding = (fileContent.data as { encoding?: string }).encoding;
                if (encoding !== "base64") continue;

                let content: string;
                try {
                  content = Buffer.from(fileContent.data.content, "base64").toString("utf-8");
                } catch {
                  continue;
                }

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

                const isProto = isPrototypePath(item.path);
                const phiCtx = repoPhiContext || detectsPhiContext(content);

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
                  services: extractServices(content),
                  has_secrets: detectSecrets(content),
                  is_prototype: isProto,
                  phi_context: phiCtx,
                  tier: pattern.tier,
                });
              }
            } catch {
              // Skip unreadable files
            }
          }
        } catch (err) {
          scanLogger.warn(
            { scanId, repo: repo.full_name, pattern: pattern.query, err: String(err) },
            "scan: search error, continuing"
          );
        }
      }
    }

    scanLogger.info({ scanId, foundAgents: foundAgents.length, reposScanned }, "scan: classifying");

    await adminClient.from("scans").update({
      status: "classifying",
      repos_scanned: reposScanned,
      agents_found: foundAgents.length,
    }).eq("id", scanId);

    for (const agent of foundAgents) {
      const classification = await classifyAgent(agent);

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
        description: classification.description,
        risk_level: classification.risk_level,
        risk_reason: classification.risk_reason,
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
    await adminClient
      .from("scans")
      .update({ status: "failed", error_message: message })
      .eq("id", scanId);
  }
}
