import { Octokit } from "@octokit/rest";
import type { Connector, SyncResult, SyncError, NormalizedAsset } from "../types/platform";
import type { NexusConnector } from "./base";
import {
  detectAIServices,
  isAIRelated,
  buildNormalizedAsset,
  classifyFilePathContext,
  looksLikeAIFrameworkRepo,
  extractAIDependenciesFromManifest,
  extractAIEnvVarsFromFile,
  AI_MANIFEST_PATHS,
  ENV_EXAMPLE_PATHS,
  type FilePathContext,
  type ManifestMatch,
} from "./base";
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
/**
 * Per-repo cap when the repo looks like an AI framework / catalog. The
 * scanner still reports what it finds, so the user sees we noticed it,
 * but the number of rows doesn't drown real findings from their other
 * repos. Ten is the arbitrary minimum that feels like "we looked" and
 * the maximum that doesn't dominate a summary.
 */
const MAX_FILES_PER_FRAMEWORK_REPO = 10;

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

    // Get repos sorted by recent activity. We pull description + name so the
    // framework detector has something to chew on.
    let repos: Array<{
      name: string;
      full_name?: string;
      description?: string | null;
      html_url: string;
      pushed_at?: string | null;
      language?: string | null;
    }> = [];
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
        const framework = looksLikeAIFrameworkRepo({
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
        });

        // Two cheap hidden-AI passes BEFORE the code search — a
        // declared dependency or an env-var entry in `.env.example`
        // is the strongest possible signal that a repo uses AI,
        // even if no code file explicitly imports an LLM library.
        const manifestAsset = await this.scanManifests(
          octokit,
          org,
          repo.name,
          repo.html_url,
          framework.isFramework,
        );
        if (manifestAsset) assets.push(manifestAsset);

        const envAsset = await this.scanEnvExample(
          octokit,
          org,
          repo.name,
          repo.html_url,
          framework.isFramework,
        );
        if (envAsset) assets.push(envAsset);

        const repoAssets = await this.scanRepo(
          octokit,
          org,
          repo.name,
          repo.html_url,
          framework.isFramework,
          framework.reason,
        );
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

  /**
   * Scan a repo's dependency manifests (package.json, pyproject.toml,
   * requirements.txt, etc.) for AI-related packages. Returns a single
   * normalized asset summarizing everything declared in every manifest,
   * or null if nothing was found.
   *
   * This catches the "wrapper module" case where a shared file calls
   * OpenAI and every downstream caller uses the wrapper — code search
   * only finds the one wrapper file, but the declared dependency is
   * unambiguous.
   */
  private async scanManifests(
    octokit: Octokit,
    org: string,
    repo: string,
    repoUrl: string,
    isFrameworkRepo: boolean,
  ): Promise<NormalizedAsset | null> {
    const matches: ManifestMatch[] = [];
    for (const manifestPath of AI_MANIFEST_PATHS) {
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner: org,
          repo,
          path: manifestPath,
        });
        if (!("content" in data && data.content)) continue;
        if ((data as { encoding?: string }).encoding !== "base64") continue;
        let content: string;
        try {
          content = Buffer.from(data.content, "base64").toString("utf8");
        } catch {
          continue;
        }
        // Cap manifest size to avoid pathological `package-lock.json`-sized files.
        if (content.length > 500_000) continue;
        matches.push(...extractAIDependenciesFromManifest(manifestPath, content));
      } catch {
        // No such manifest, or unreadable — move on.
      }
    }

    if (matches.length === 0) return null;

    // Dedupe providers across manifests so a project listing the same
    // library in both pyproject.toml and requirements.txt counts once.
    const providers = Array.from(new Set(matches.map((m) => m.provider)));
    const manifestsWithHits = Array.from(new Set(matches.map((m) => m.manifestPath)));
    const externalId = `${org}/${repo}:manifest`;
    const primaryManifest = manifestsWithHits[0];

    return buildNormalizedAsset({
      externalId,
      name: `${repo} — declared AI dependencies`,
      description: `Repository declares ${providers.length} AI provider${providers.length === 1 ? "" : "s"} in its dependency manifest${manifestsWithHits.length === 1 ? "" : "s"}: ${providers.join(", ")}. This is a strong hidden-AI signal even without any code import.`,
      kind: "integration",
      sourceUrl: `${repoUrl}/blob/HEAD/${primaryManifest}`,
      environment: isFrameworkRepo ? "development" : "production",
      aiServices: providers.map((p) => ({ provider: p })),
      dataClassification: isFrameworkRepo ? ["internal"] : ["unknown"],
      tags: [repo, org, "declared-dependency", ...(isFrameworkRepo ? ["framework-internals"] : [])],
      rawMetadata: {
        org,
        repo,
        manifestPaths: manifestsWithHits,
        providers,
        source: "manifest",
        frameworkRepo: isFrameworkRepo,
      },
    });
  }

  /**
   * Scan `.env.example` / `.env.sample` / `.env.template` for AI-related
   * env var declarations. A committed env-var stub is the clearest
   * possible signal — the team already decided to ship this feature.
   * Returns a single summarizing asset or null.
   */
  private async scanEnvExample(
    octokit: Octokit,
    org: string,
    repo: string,
    repoUrl: string,
    isFrameworkRepo: boolean,
  ): Promise<NormalizedAsset | null> {
    for (const envPath of ENV_EXAMPLE_PATHS) {
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner: org,
          repo,
          path: envPath,
        });
        if (!("content" in data && data.content)) continue;
        if ((data as { encoding?: string }).encoding !== "base64") continue;
        let content: string;
        try {
          content = Buffer.from(data.content, "base64").toString("utf8");
        } catch {
          continue;
        }
        if (content.length > 200_000) continue;

        const providers = extractAIEnvVarsFromFile(content);
        if (providers.length === 0) continue;

        return buildNormalizedAsset({
          externalId: `${org}/${repo}:env-example`,
          name: `${repo} — AI env vars in ${envPath}`,
          description: `${envPath} declares env vars for ${providers.length} AI provider${providers.length === 1 ? "" : "s"}: ${providers.join(", ")}. The team has already wired this as an operational feature — look for the corresponding deployment and owner.`,
          kind: "integration",
          sourceUrl: `${repoUrl}/blob/HEAD/${envPath}`,
          environment: isFrameworkRepo ? "development" : "production",
          aiServices: providers.map((p) => ({ provider: p })),
          dataClassification: isFrameworkRepo ? ["internal"] : ["unknown"],
          tags: [repo, org, "declared-env-var", ...(isFrameworkRepo ? ["framework-internals"] : [])],
          rawMetadata: {
            org,
            repo,
            envPath,
            providers,
            source: "env-example",
            frameworkRepo: isFrameworkRepo,
          },
        });
      } catch {
        // No such env file — try the next one.
      }
    }
    return null;
  }

  private async scanRepo(
    octokit: Octokit,
    org: string,
    repo: string,
    _repoUrl: string,
    isFrameworkRepo: boolean,
    frameworkReason?: string,
  ): Promise<NormalizedAsset[]> {
    const assets: NormalizedAsset[] = [];
    const foundFiles = new Set<string>();
    const capForThisRepo = isFrameworkRepo ? MAX_FILES_PER_FRAMEWORK_REPO : MAX_FILES_PER_REPO;

    for (const pattern of AI_FILE_PATTERNS) {
      if (foundFiles.size >= capForThisRepo) break;

      try {
        const results = await withRetry(async () => {
          const { data } = await octokit.rest.search.code({
            q: `${pattern} in:file repo:${org}/${repo}`,
            per_page: 5,
          });
          return data.items;
        });

        for (const item of results) {
          if (foundFiles.size >= capForThisRepo) break;
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

          // Path context is the single most important new signal — it
          // decides whether this finding is a customer-facing feature,
          // a dev-tooling rules file, a doc, or an internal library.
          const ctx = classifyFilePathContext(item.path);

          // Skip purely educational paths — they're not operational AI.
          // We don't even want them as low-severity rows because a
          // customer's `examples/` folder from a copied tutorial will
          // create a dozen rows of nothing-burger.
          if (ctx === "educational") continue;

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

          // Tags carry human-readable context through to the UI so a
          // CTO scanning the asset registry can immediately see
          // "customer-facing" vs "dev tooling" without re-reading paths.
          const tags = [repo, org, ...contextTags(ctx)];
          if (isFrameworkRepo) tags.push("framework-internals");

          assets.push(
            buildNormalizedAsset({
              externalId: `${org}/${repo}/${item.path}`,
              name: `${repo}/${item.path}`,
              description: buildAssetDescription(org, repo, ctx, isFrameworkRepo),
              kind: inferKind(item.path, content),
              sourceUrl: item.html_url,
              environment: inferEnvFromContext(ctx, repo, item.path),
              ownerEmail,
              aiServices,
              dataClassification: inferDataClassification(content, ctx, isFrameworkRepo),
              tags,
              rawMetadata: {
                org,
                repo,
                filePath: item.path,
                lastCommitterEmail,
                sha: item.sha,
                pathContext: ctx,
                frameworkRepo: isFrameworkRepo,
                frameworkReason,
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

/**
 * Environment inference that prefers path context when we have it.
 * A user-facing API route is almost always production. Dev tooling is
 * development. Library internals are ambiguous so we fall back to the
 * name-based heuristic (which looks for `/prod/`, `/staging/`, etc.).
 */
function inferEnvFromContext(
  ctx: FilePathContext,
  repo: string,
  filePath: string,
): NormalizedAsset["environment"] {
  if (ctx === "user_facing") return "production";
  if (ctx === "dev_tooling") return "development";
  if (/prod/i.test(repo) || /prod/i.test(filePath)) return "production";
  if (/stag|staging/i.test(repo) || /staging/i.test(filePath)) return "staging";
  if (/dev|local/i.test(repo)) return "development";
  return "unknown";
}

/**
 * Data-classification inference that degrades signals for dev tooling.
 * A prompts file that mentions "PHI" as an example shouldn't tag the
 * finding as PHI-handling. We still respect explicit strings in
 * user-facing or library code.
 */
function inferDataClassification(
  content: string,
  ctx: FilePathContext,
  isFrameworkRepo: boolean,
): string[] {
  if (ctx === "dev_tooling" || isFrameworkRepo) return ["internal"];
  const classes: string[] = [];
  if (/pii|personally identifiable|personal data/i.test(content)) classes.push("pii");
  if (/phi|health data|hipaa|medical/i.test(content)) classes.push("phi");
  if (/financial|payment|stripe|credit.?card/i.test(content)) classes.push("financial");
  if (classes.length === 0) classes.push("internal");
  return classes;
}

function contextTags(ctx: FilePathContext): string[] {
  switch (ctx) {
    case "user_facing":
      return ["customer-facing"];
    case "dev_tooling":
      return ["dev-tooling"];
    case "library_internal":
      return ["library"];
    case "educational":
      return ["educational"];
    default:
      return [];
  }
}

function buildAssetDescription(
  org: string,
  repo: string,
  ctx: FilePathContext,
  isFrameworkRepo: boolean,
): string {
  if (isFrameworkRepo) {
    return `AI-related file in ${org}/${repo} — repo looks like an AI framework or catalog, findings reflect library internals rather than operational usage.`;
  }
  switch (ctx) {
    case "user_facing":
      return `Customer-facing AI touchpoint in ${org}/${repo} — lives in an API route or server handler.`;
    case "dev_tooling":
      return `Developer-tooling AI configuration in ${org}/${repo} — rules/prompts file for a coding assistant, not a product feature.`;
    case "library_internal":
      return `Internal library code in ${org}/${repo} — shared helper, not a direct customer touchpoint.`;
    default:
      return `AI-related file in ${org}/${repo}.`;
  }
}
