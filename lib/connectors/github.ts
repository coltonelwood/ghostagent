import { Octokit } from "@octokit/rest";
import type { Connector, SyncResult, SyncError, NormalizedAsset } from "../types/platform";
import type { NexusConnector } from "./base";
import { detectAIServices, isAIRelated, buildNormalizedAsset } from "./base";
import { withRetry } from "../retry";
import { logger } from "../logger";

const AI_FILE_PATTERNS = [
  "langchain",
  "openai",
  "anthropic",
  "llamaindex",
  "huggingface",
  "amazon-bedrock",
  "google-generativeai",
  "azure-openai",
];

const MAX_REPOS = 25;
const MAX_FILES_PER_REPO = 10;

export class GitHubConnector implements NexusConnector {
  kind = "github" as const;
  displayName = "GitHub";
  description = "Scan GitHub repositories for AI agent code";
  category = "code" as const;
  icon = "github";

  async validate(credentials: Record<string, string>) {
    try {
      const octokit = new Octokit({ auth: credentials.token });
      await octokit.rest.orgs.get({ org: credentials.org });
      return { valid: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { valid: false, error: msg };
    }
  }

  async sync(connector: Connector, credentials: Record<string, string>): Promise<SyncResult> {
    const octokit = new Octokit({
      auth: credentials.token,
      request: { timeout: 30_000 },
    });

    const org = (connector.config?.org as string) || credentials.org;
    const assets: NormalizedAsset[] = [];
    const errors: SyncError[] = [];

    // Get repos sorted by recent activity
    let repos: Array<{ name: string; html_url: string; pushed_at?: string | null; language?: string | null }> = [];
    try {
      repos = await withRetry(async () => {
        const { data } = await octokit.rest.repos.listForOrg({
          org,
          sort: "pushed",
          direction: "desc",
          per_page: MAX_REPOS,
        });
        return data;
      });
    } catch (err: unknown) {
      errors.push({
        resource: `org/${org}`,
        message: `Failed to list repos: ${err instanceof Error ? err.message : String(err)}`,
        recoverable: false,
      });
      return { assets, errors, metadata: {} };
    }

    for (const repo of repos.slice(0, MAX_REPOS)) {
      try {
        const repoAssets = await this.scanRepo(octokit, org, repo.name, repo.html_url);
        assets.push(...repoAssets);
      } catch (err: unknown) {
        errors.push({
          resource: `${org}/${repo.name}`,
          message: err instanceof Error ? err.message : String(err),
          recoverable: true,
        });
      }
    }

    logger.info({ org, repos: repos.length, assets: assets.length, errors: errors.length }, "github: sync complete");
    return { assets, errors, metadata: { org, reposScanned: repos.length } };
  }

  private async scanRepo(
    octokit: Octokit,
    org: string,
    repo: string,
    repoUrl: string
  ): Promise<NormalizedAsset[]> {
    const assets: NormalizedAsset[] = [];
    const foundFiles = new Set<string>();

    for (const pattern of AI_FILE_PATTERNS) {
      if (foundFiles.size >= MAX_FILES_PER_REPO) break;

      try {
        const results = await withRetry(async () => {
          const { data } = await octokit.rest.search.code({
            q: `${pattern} in:file repo:${org}/${repo}`,
            per_page: 5,
          });
          return data.items;
        });

        for (const item of results) {
          if (foundFiles.has(item.path)) continue;
          foundFiles.add(item.path);

          // Get file content to detect services
          let content = "";
          try {
            const { data: fileData } = await octokit.rest.repos.getContent({
              owner: org,
              repo,
              path: item.path,
            });
            if ("content" in fileData && fileData.content) {
              content = Buffer.from(fileData.content, "base64").toString("utf8").slice(0, 5000);
            }
          } catch { /* ignore */ }

          const aiServices = detectAIServices(content || item.path);
          if (!isAIRelated(item.path) && !aiServices.length) continue;

          // Try to get committer email
          let ownerEmail: string | undefined;
          let lastCommitterEmail: string | undefined;
          try {
            const { data: commits } = await octokit.rest.repos.listCommits({
              owner: org,
              repo,
              path: item.path,
              per_page: 1,
            });
            const email = commits[0]?.commit?.author?.email;
            if (email && !email.includes("noreply")) {
              ownerEmail = email;
              lastCommitterEmail = email;
            }
          } catch { /* ignore */ }

          assets.push(
            buildNormalizedAsset({
              externalId: `${org}/${repo}/${item.path}`,
              name: `${repo}/${item.path}`,
              description: `AI-related file in ${org}/${repo}`,
              kind: inferKind(item.path, content),
              sourceUrl: item.html_url,
              environment: inferEnv(repo, item.path),
              ownerEmail,
              aiServices,
              dataClassification: inferDataClassification(content),
              tags: [repo, org],
              rawMetadata: {
                org,
                repo,
                filePath: item.path,
                lastCommitterEmail,
                sha: item.sha,
              },
            })
          );
        }
      } catch (err: unknown) {
        // Rate limit or other error — stop scanning this pattern
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("rate limit") || msg.includes("403")) break;
      }
    }

    return assets;
  }
}

function inferKind(path: string, content: string): NormalizedAsset["kind"] {
  if (/agent/i.test(path) || /Agent\s*=/i.test(content)) return "agent";
  if (/pipeline/i.test(path)) return "pipeline";
  if (/workflow/i.test(path)) return "workflow";
  if (/\.py$/i.test(path) || /\.js$/i.test(path)) return "script";
  return "unknown";
}

function inferEnv(repo: string, filePath: string): NormalizedAsset["environment"] {
  if (/prod/i.test(repo) || /prod/i.test(filePath)) return "production";
  if (/stag|staging/i.test(repo) || /staging/i.test(filePath)) return "staging";
  if (/dev|local/i.test(repo)) return "development";
  return "unknown";
}

function inferDataClassification(content: string): string[] {
  const classes: string[] = [];
  if (/pii|personally identifiable|personal data/i.test(content)) classes.push("pii");
  if (/phi|health data|hipaa|medical/i.test(content)) classes.push("phi");
  if (/financial|payment|stripe|credit.?card/i.test(content)) classes.push("financial");
  if (classes.length === 0) classes.push("internal");
  return classes;
}
