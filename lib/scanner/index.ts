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

const AGENT_PATTERNS = [
  { query: "langchain", label: "LangChain" },
  { query: "openai.chat.completions", label: "OpenAI" },
  { query: "anthropic", label: "Anthropic" },
  { query: "crewai", label: "CrewAI" },
  { query: "autogen", label: "AutoGen" },
  { query: "from openai import", label: "OpenAI SDK" },
  { query: "ChatOpenAI", label: "LangChain" },
  { query: "AgentExecutor", label: "LangChain" },
  { query: "function_call", label: "OpenAI Functions" },
  { query: "tool_calls", label: "OpenAI Tools" },
  { query: "AutoGPT", label: "AutoGPT" },
  { query: "semantic_kernel", label: "Semantic Kernel" },
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
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const result = JSON.parse(response.choices[0].message.content ?? "{}");
    return {
      risk_level: result.risk_level ?? "medium",
      risk_reason: result.risk_reason ?? "Unable to classify",
      description: result.description ?? "AI agent detected",
    };
  } catch {
    // Fallback heuristic classification
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
      risk_reason: "Classified by heuristic (OpenAI unavailable)",
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
    request: { timeout: 30_000 }, // 30s timeout per request
  });

  scanLogger.info({ scanId, workspaceId, org: workspace.github_org }, "scan: starting");

  // Update scan status
  await adminClient
    .from("scans")
    .update({ status: "scanning" })
    .eq("id", scanId);

  try {
    // Get all repos — retry on transient failures
    const repos = await withRetry(
      () => octokit.paginate(octokit.repos.listForOrg, {
        org: workspace.github_org,
        per_page: 100,
        type: "all",
      }),
      { label: `listForOrg(${workspace.github_org})`, maxAttempts: 3 }
    );

    scanLogger.info({ scanId, repoCount: repos.length }, "scan: repos fetched");

    const foundAgents: FoundAgent[] = [];
    let reposScanned = 0;

    for (const repo of repos) {
      reposScanned++;

      // Update progress every 5 repos
      if (reposScanned % 5 === 0) {
        await adminClient
          .from("scans")
          .update({ repos_scanned: reposScanned })
          .eq("id", scanId);
      }

      // Search for agent patterns in this repo
      for (const pattern of AGENT_PATTERNS) {
        try {
          // GitHub search API: 30 requests/min for authenticated users
          // 2.1s delay = safe headroom under the limit
          await sleep(2100);

          const searchResult = await withRetry(
            () => octokit.search.code({
              q: `${pattern.query} repo:${repo.full_name}`,
              per_page: 10,
            }),
            {
              label: `search(${pattern.query} in ${repo.full_name})`,
              maxAttempts: 3,
              baseDelayMs: 5000, // longer base delay for search rate limits
              shouldRetry: (err) => {
                const status = (err as { status?: number })?.status;
                // Retry on rate limit and server errors only
                return status === 429 || status === 503 || status === 504 ||
                  String(err).includes("secondary rate limit");
              },
            }
          );

          for (const item of searchResult.data.items) {
            // Skip node_modules, vendor, etc.
            if (
              item.path.includes("node_modules") ||
              item.path.includes("vendor") ||
              item.path.includes(".lock") ||
              item.path.includes("package-lock") ||
              item.path.includes(".min.")
            ) {
              continue;
            }

            // Check if we already found this file
            if (foundAgents.some((a) => a.repo === repo.full_name && a.file_path === item.path)) {
              continue;
            }

            // Get file content
            try {
              const fileContent = await octokit.repos.getContent({
                owner: workspace.github_org,
                repo: repo.name,
                path: item.path,
              });

              if ("content" in fileContent.data && fileContent.data.content) {
                // Skip binary files (images, zips, etc.)
                const encoding = (fileContent.data as { encoding?: string }).encoding;
                if (encoding !== "base64") continue;

                let content: string;
                try {
                  content = Buffer.from(
                    fileContent.data.content,
                    "base64"
                  ).toString("utf-8");
                } catch {
                  continue; // skip undecodable files
                }

                // Skip files that are clearly not agent code (>500KB likely generated)
                if (content.length > 500_000) continue;

                // Get last commit info for this file
                const commits = await octokit.repos.listCommits({
                  owner: workspace.github_org,
                  repo: repo.name,
                  path: item.path,
                  per_page: 1,
                });

                const lastCommit = commits.data[0];
                const lastCommitDate = lastCommit?.commit?.author?.date ?? null;
                const daysSince = lastCommitDate
                  ? Math.floor(
                      (Date.now() - new Date(lastCommitDate).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
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
              // Skip files we can't read
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

    // Classify agents with OpenAI
    await adminClient
      .from("scans")
      .update({
        status: "classifying",
        repos_scanned: reposScanned,
        agents_found: foundAgents.length,
      })
      .eq("id", scanId);

    // Process in batches of 5 with retry
    for (let i = 0; i < foundAgents.length; i += 5) {
      const batch = foundAgents.slice(i, i + 5);
      const classified = await Promise.all(batch.map(classifyAgent));

      const inserts = batch.map((agent, idx) => ({
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
        description: classified[idx].description,
        risk_level: classified[idx].risk_level,
        risk_reason: classified[idx].risk_reason,
        services: agent.services,
        has_secrets: agent.has_secrets,
      }));

      await withRetry(
        async () => {
          const r = await adminClient.from("agents")
            .upsert(inserts, {
              onConflict: "scan_id,repo,file_path",
              ignoreDuplicates: true,
            });
          if (r.error) throw r.error;
        },
        { label: "agents.upsert", maxAttempts: 3 }
      );
    }

    // Mark scan complete
    await adminClient
      .from("scans")
      .update({
        status: "completed",
        repos_scanned: reposScanned,
        agents_found: foundAgents.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", scanId);

    scanLogger.info({ scanId, workspaceId, agentsFound: foundAgents.length }, "scan: completed");

    // Increment workspace scan count
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
