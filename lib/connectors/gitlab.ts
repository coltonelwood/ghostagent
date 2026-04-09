import type { Connector, SyncResult, NormalizedAsset } from "../types/platform";
import type { NexusConnector } from "./base";
import { detectAIServices, isAIRelated, buildNormalizedAsset } from "./base";
import { withRetry } from "../retry";
import { logger } from "../logger";
import { validateUrl } from "../ssrf-guard";

export class GitLabConnector implements NexusConnector {
  kind = "gitlab" as const;
  displayName = "GitLab";
  description = "Scan GitLab projects for AI-related code and pipelines";
  category = "code" as const;
  icon = "gitlab";

  private getBase(credentials: Record<string, string>): string {
    const url = credentials.baseUrl || "https://gitlab.com";
    // SSRF guard: validate before use
    validateUrl(url, "gitlab");
    return url.replace(/\/$/, "");
  }

  async validate(credentials: Record<string, string>) {
    try {
      const base = this.getBase(credentials);
      const res = await fetch(`${base}/api/v4/user`, {
        headers: { "PRIVATE-TOKEN": credentials.token },
      });
      if (!res.ok) throw new Error(`GitLab returned ${res.status}`);
      return { valid: true };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async sync(connector: Connector, credentials: Record<string, string>): Promise<SyncResult> {
    const base = this.getBase(credentials);
    const headers = { "PRIVATE-TOKEN": credentials.token };
    const assets: NormalizedAsset[] = [];
    const errors: SyncError[] = [];

    // Get all accessible projects
    let projects: Array<{ id: number; name: string; path_with_namespace: string; web_url: string }> = [];
    try {
      projects = await this.paginate<{ id: number; name: string; path_with_namespace: string; web_url: string }>(
        `${base}/api/v4/projects?membership=true&order_by=last_activity_at&per_page=50`,
        headers
      );
    } catch (err) {
      errors.push({
        resource: "projects",
        message: err instanceof Error ? err.message : String(err),
        recoverable: false,
      });
      return { assets, errors, metadata: {} };
    }

    const AI_TERMS = ["openai", "langchain", "anthropic", "llm", "gemini", "bedrock"];

    for (const project of projects.slice(0, 30)) {
      for (const term of AI_TERMS) {
        try {
          const results = await withRetry(() =>
            fetch(
              `${base}/api/v4/projects/${project.id}/search?scope=blobs&search=${term}`,
              { headers }
            ).then((r) => {
              if (r.status === 429) throw new Error("rate_limit");
              return r.json() as Promise<Array<{ filename: string; path: string; id: string }>>;
            })
          );

          for (const file of (Array.isArray(results) ? results : []).slice(0, 5)) {
            const externalId = `${project.path_with_namespace}/${file.path}`;
            if (assets.some((a) => a.externalId === externalId)) continue;

            const aiServices = detectAIServices(file.filename + " " + term);
            if (!isAIRelated(file.filename) && !aiServices.length) continue;

            assets.push(
              buildNormalizedAsset({
                externalId,
                name: `${project.name}/${file.path}`,
                description: `AI-related file in ${project.path_with_namespace}`,
                kind: "script",
                sourceUrl: `${project.web_url}/-/blob/main/${file.path}`,
                environment: "unknown",
                aiServices: detectAIServices(term),
                dataClassification: ["internal"],
                tags: [project.name],
                rawMetadata: {
                  projectId: project.id,
                  projectPath: project.path_with_namespace,
                  filePath: file.path,
                },
              })
            );
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg === "rate_limit") break;
          errors.push({ resource: `${project.path_with_namespace}/${term}`, message: msg, recoverable: true });
        }
      }
    }

    logger.info({ projects: projects.length, assets: assets.length }, "gitlab: sync complete");
    return { assets, errors, metadata: { projectsScanned: projects.length } };
  }

  private async paginate<T>(url: string, headers: Record<string, string>): Promise<T[]> {
    const results: T[] = [];
    let nextUrl: string | null = url;

    while (nextUrl && results.length < 200) {
      const res: Response = await fetch(nextUrl, { headers });
      if (!res.ok) throw new Error(`GitLab returned ${res.status}`);

      const data = await res.json() as T[];
      results.push(...data);

      const link: string = res.headers.get("link") ?? "";
      const match: RegExpMatchArray | null = link.match(/<([^>]+)>;\s*rel="next"/);
      nextUrl = match ? match[1] : null;
    }

    return results;
  }
}

interface SyncError {
  resource: string;
  message: string;
  recoverable: boolean;
}
