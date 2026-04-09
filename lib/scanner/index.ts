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

// Cap repos scanned per run to stay within Vercel 300s limit
// 50 repos × 12 patterns × 2.1s = ~21 min — too long
// 10 repos × 12 patterns × 2.1s = ~4.2 min — safe for 300s limit
const MAX_REPOS_PER_SCAN = 10;

// Reduce patterns to highest-signal ones only
const AGENT_PATTERNS = [
  { query: "langchain", label: "LangChain" },
  { query: "ChatOpenAI", label: "LangChain" },
  { query: "openai.chat.completions", label: "OpenAI" },
  { query: "anthropic", label: "Anthropic" },
  { query: "crewai", label: "CrewAI" },
  { query: "AgentExecutor", label: "LangChain" },
];
// 6 patterns × 10 repos × 2.1s = 2.1 min — safe within any Vercel plan

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
};

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
}

async function classifyAgent(
  agent: FoundAgent
): Promise<{ risk_level: string; risk_reason: string; description: string }> {
  const prompt = `You are a security analyst. Classify this AI agent found in a GitHub organization.

Agent file: ${agent.file_path}
Repository: ${agent.repo}
Agent type: ${agent.agent_type}
Last commit by: ${agent.owner_github ?? "unknown"}
Days since last commit: ${agent.days_since_commit ?? "unknown"}
Connected services: ${agent.services.join(", ") || "none detected"}
Contains hardcoded secrets: ${agent.has_secrets}

Code snippet (first 2000 chars):
${agent.content.slice(0, 2000)}

Respond in JSON with:
- risk_level: "critical" | "high" | "medium" | "low"
- risk_reason: one sentence explaining the risk
- description: one sentence describing what this agent does

Rules:
- critical: has secrets, connects to payment/customer systems, owner gone >180 days
- high: connects to external services, owner gone >90 days
- medium: runs autonomously, owner gone >30 days
- low: simple scripts, recently maintained`;

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
    return {
      risk_level: result.risk_level ?? "medium",
      risk_reason: result.risk_reason ?? "Unable to classify",
      description: result.description ?? "AI agent detected",
    };
  } catch {
    // Heuristic fallback — never fail the scan because GPT-4o is down
    let risk_level = "medium";
    if (agent.has_secrets || (agent.days_since_commit && agent.days_since_commit > 180)) {
      risk_level = "critical";
    } else if (agent.services.length > 2 || (agent.days_since_commit && agent.days_since_commit > 90)) {
      risk_level = "high";
    } else if (agent.days_since_commit && agent.days_since_commit < 30) {
      risk_level = "low";
    }
    return {
      risk_level,
      risk_reason: "Classified by heuristic (AI unavailable)",
      description: `${agent.agent_type} agent in ${agent.repo}`,
    };
  }
}

export async function runScan(scanId: string, workspaceId: string) {
  // Get workspace details
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

  await adminClient
    .from("scans")
    .update({ status: "scanning" })
    .eq("id", scanId);

  const scanStart = Date.now();
  // Hard time limit: 4 minutes (leave 60s buffer for Vercel's 300s limit)
  const TIME_LIMIT_MS = 4 * 60 * 1000;

  try {
    // Fetch repos — capped
    const repos = await withRetry(
      () => octokit.paginate(octokit.repos.listForOrg, {
        org: workspace.github_org,
        per_page: 100,
        type: "all",
        sort: "pushed",     // Most recently active repos first
        direction: "desc",  // Most likely to have AI agents
      }),
      { label: `listForOrg(${workspace.github_org})`, maxAttempts: 3 }
    );

    // Cap to MAX_REPOS_PER_SCAN most recently active
    const targetRepos = repos.slice(0, MAX_REPOS_PER_SCAN);

    scanLogger.info({
      scanId,
      totalRepos: repos.length,
      scanning: targetRepos.length,
    }, "scan: repos fetched, scanning subset");

    const foundAgents: FoundAgent[] = [];
    let reposScanned = 0;

    for (const repo of targetRepos) {
      // Time-based safety valve — stop if approaching limit
      if (Date.now() - scanStart > TIME_LIMIT_MS) {
        scanLogger.warn({ scanId, reposScanned }, "scan: approaching time limit, stopping early");
        break;
      }

      reposScanned++;

      if (reposScanned % 3 === 0) {
        await adminClient
          .from("scans")
          .update({ repos_scanned: reposScanned })
          .eq("id", scanId);
      }

      for (const pattern of AGENT_PATTERNS) {
        // Time valve check inside inner loop too
        if (Date.now() - scanStart > TIME_LIMIT_MS) break;

        // GitHub search rate limit: 30 req/min — 2s between requests is safe
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

    scanLogger.info({ scanId, foundAgents: foundAgents.length, reposScanned }, "scan: classifying agents");

    await adminClient
      .from("scans")
      .update({
        status: "classifying",
        repos_scanned: reposScanned,
        agents_found: foundAgents.length,
      })
      .eq("id", scanId);

    // Classify sequentially (not parallel) to avoid OpenAI rate limits at scale
    for (let i = 0; i < foundAgents.length; i++) {
      const agent = foundAgents[i];
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

    await adminClient
      .from("scans")
      .update({
        status: "completed",
        repos_scanned: reposScanned,
        agents_found: foundAgents.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", scanId);

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
