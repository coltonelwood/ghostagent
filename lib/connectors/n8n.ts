import type { Connector, SyncResult } from "../types/platform";
import type { NexusConnector } from "./base";
import { detectAIServices, buildNormalizedAsset } from "./base";
import { logger } from "../logger";
import { validateUrl, SSRFError } from "../ssrf-guard";

const AI_NODE_PATTERNS = /langchain|openai|claude|anthropic|gemini|mistral|cohere|ai\./i;

export class N8nConnector implements NexusConnector {
  kind = "n8n" as const;
  displayName = "n8n";
  description = "Discover AI workflows in your n8n instance";
  category = "automation" as const;
  icon = "workflow";

  private getHeaders(credentials: Record<string, string>) {
    return { "X-N8N-API-KEY": credentials.apiKey, "Accept": "application/json" };
  }

  async validate(credentials: Record<string, string>) {
    try {
      validateUrl(credentials.instanceUrl, "n8n"); // SSRF guard
      const base = credentials.instanceUrl.replace(/\/$/, "");
      const res = await fetch(`${base}/api/v1/workflows?limit=1`, {
        headers: this.getHeaders(credentials),
      });
      if (!res.ok) throw new Error(`n8n returned ${res.status}`);
      return { valid: true };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async sync(_connector: Connector, credentials: Record<string, string>): Promise<SyncResult> {
    try { validateUrl(credentials.instanceUrl, "n8n"); } catch (e) {
      return { assets: [], errors: [{ resource: "n8n", message: String(e), recoverable: false }], metadata: { service: "n8n", error: "ssrf_blocked" } };
    }
    const base = credentials.instanceUrl.replace(/\/$/, "");
    const headers = this.getHeaders(credentials);
    const assets = [];
    const errors: Array<{ resource: string; message: string; recoverable: boolean }> = [];

    try {
      let cursor: string | undefined;
      const allWorkflows: N8nWorkflow[] = [];

      do {
        const url = `${base}/api/v1/workflows?limit=50${cursor ? `&cursor=${cursor}` : ""}`;
        const res = await fetch(url, { headers });
        if (!res.ok) {
          if (res.status === 429) break;
          throw new Error(`n8n returned ${res.status}`);
        }
        const data = await res.json() as { data: N8nWorkflow[]; nextCursor?: string };
        allWorkflows.push(...data.data);
        cursor = data.nextCursor;
      } while (cursor && allWorkflows.length < 500);

      for (const wf of allWorkflows) {
        const nodeTypes = wf.nodes?.map((n) => n.type).join(" ") ?? "";
        const nodeNames = wf.nodes?.map((n) => n.name).join(" ") ?? "";
        const text = `${wf.name} ${nodeTypes} ${nodeNames}`;

        if (!AI_NODE_PATTERNS.test(text)) continue;

        const aiServices = detectAIServices(text);

        assets.push(
          buildNormalizedAsset({
            externalId: String(wf.id),
            name: wf.name,
            description: `n8n workflow with AI nodes`,
            kind: "workflow",
            sourceUrl: `${base}/workflow/${wf.id}`,
            environment: wf.active ? "production" : "development",
            aiServices,
            dataClassification: ["internal"],
            tags: ["n8n", "automation"],
            rawMetadata: {
              workflowId: wf.id,
              active: wf.active,
              nodeCount: wf.nodes?.length ?? 0,
              createdAt: wf.createdAt,
              updatedAt: wf.updatedAt,
            },
          })
        );
      }
    } catch (err) {
      errors.push({ resource: "workflows", message: err instanceof Error ? err.message : String(err), recoverable: false });
    }

    logger.info({ assets: assets.length }, "n8n: sync complete");
    return { assets, errors, metadata: { service: "n8n" } };
  }
}

interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  nodes?: Array<{ type: string; name: string }>;
}
