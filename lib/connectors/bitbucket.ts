// ============================================================
// Bitbucket Connector
// ============================================================

import type { Connector, SyncResult, NormalizedAsset } from "../types/platform";
import type { NexusConnector } from "./base";
import { detectAIServices, isAIRelated, buildNormalizedAsset } from "./base";
import { withRetry } from "../retry";
import { logger } from "../logger";

export class BitbucketConnector implements NexusConnector {
  kind = "bitbucket" as const;
  displayName = "Bitbucket";
  description = "Scan Bitbucket repositories for AI agent code and integrations";
  category = "code" as const;
  icon = "git-branch";

  private getHeaders(credentials: Record<string, string>) {
    const encoded = Buffer.from(
      `${credentials.username}:${credentials.appPassword}`,
    ).toString("base64");
    return { Authorization: `Basic ${encoded}` };
  }

  async validate(credentials: Record<string, string>) {
    try {
      const res = await fetch("https://api.bitbucket.org/2.0/user", {
        headers: this.getHeaders(credentials),
      });
      if (!res.ok) throw new Error(`Bitbucket returned ${res.status}`);
      return { valid: true };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async sync(_connector: Connector, credentials: Record<string, string>): Promise<SyncResult> {
    const headers = this.getHeaders(credentials);
    const workspace = credentials.workspace;
    const assets: NormalizedAsset[] = [];
    const errors: SyncError[] = [];

    const AI_TERMS = ["openai", "langchain", "anthropic", "llm", "bedrock", "gemini"];

    for (const term of AI_TERMS) {
      try {
        let url: string | null =
          `https://api.bitbucket.org/2.0/workspaces/${encodeURIComponent(workspace)}/search/code?search_query=${encodeURIComponent(term)}&pagelen=25`;

        while (url && assets.length < 200) {
          const res = await withRetry(() => fetch(url!, { headers }));

          if (res.status === 429) {
            const retryAfter = Number(res.headers.get("Retry-After") || "60");
            await new Promise((r) => setTimeout(r, retryAfter * 1000));
            continue;
          }

          if (!res.ok) {
            throw new Error(`Bitbucket returned ${res.status}`);
          }

          const data = await res.json() as BitbucketSearchResult;

          for (const item of data.values ?? []) {
            const filePath = item.file?.path ?? "unknown";
            const repoSlug =
              item.file?.links?.self?.href?.match(
                /repositories\/[^/]+\/([^/]+)/,
              )?.[1] ?? "unknown";

            const externalId = `${workspace}/${repoSlug}/${filePath}`;
            if (assets.some((a) => a.externalId === externalId)) continue;

            const text = `${filePath} ${term}`;
            const aiServices = detectAIServices(text);
            if (!isAIRelated(filePath) && !aiServices.length) continue;

            assets.push(
              buildNormalizedAsset({
                externalId,
                name: `${repoSlug}/${filePath}`,
                description: `AI-related file in ${workspace}/${repoSlug}`,
                kind: "script",
                sourceUrl: item.file?.links?.self?.href,
                environment: "unknown",
                aiServices,
                dataClassification: ["internal"],
                tags: [repoSlug, workspace],
                rawMetadata: {
                  workspace,
                  repo: repoSlug,
                  filePath,
                },
              }),
            );
          }

          url = data.next ?? null;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ resource: `search/${term}`, message: msg, recoverable: true });
      }
    }

    logger.info({ workspace, assets: assets.length }, "bitbucket: sync complete");
    return { assets, errors, metadata: { workspace } };
  }
}

interface BitbucketSearchResult {
  values?: Array<{
    file?: {
      path?: string;
      links?: { self?: { href?: string } };
    };
  }>;
  next?: string;
}

interface SyncError {
  resource: string;
  message: string;
  recoverable: boolean;
}
