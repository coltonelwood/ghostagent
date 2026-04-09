import type { Connector, SyncResult, NormalizedAsset } from "../types/platform";
import type { NexusConnector } from "./base";
import { detectAIServices, buildNormalizedAsset } from "./base";
import { logger } from "../logger";

const AI_APP_NAMES = /openai|anthropic|claude|gemini|cohere|chatgpt|gpt/i;

export class ZapierConnector implements NexusConnector {
  kind = "zapier" as const;
  displayName = "Zapier";
  description = "Discover AI-powered Zaps across your Zapier account";
  category = "automation" as const;
  icon = "zap";

  async validate(credentials: Record<string, string>) {
    try {
      const res = await fetch("https://api.zapier.com/v1/zaps?limit=1", {
        headers: { "X-API-Key": credentials.apiKey },
      });
      if (!res.ok) throw new Error(`Zapier returned ${res.status}`);
      return { valid: true };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async sync(_connector: Connector, credentials: Record<string, string>): Promise<SyncResult> {
    const assets: NormalizedAsset[] = [];
    const errors: SyncError[] = [];

    try {
      // Fetch all zaps
      let offset = 0;
      const limit = 50;
      let hasMore = true;
      const allZaps: ZapierZap[] = [];

      while (hasMore && allZaps.length < 500) {
        const res = await fetch(`https://api.zapier.com/v1/zaps?limit=${limit}&offset=${offset}`, {
          headers: { "X-API-Key": credentials.apiKey },
        });

        if (!res.ok) {
          if (res.status === 429) break;
          throw new Error(`Zapier returned ${res.status}`);
        }

        const data = await res.json() as { zaps: ZapierZap[]; next: string | null };
        allZaps.push(...data.zaps);
        hasMore = !!data.next && data.zaps.length === limit;
        offset += limit;
      }

      // Filter for AI-related zaps
      for (const zap of allZaps) {
        const appNames = zap.steps?.map((s) => s.app?.title ?? "").join(" ") ?? "";
        const zapText = `${zap.title} ${appNames}`;

        if (!AI_APP_NAMES.test(zapText)) continue;

        const aiServices = detectAIServices(zapText);

        assets.push(
          buildNormalizedAsset({
            externalId: String(zap.id),
            name: zap.title || `Zap #${zap.id}`,
            description: `Zapier workflow with AI integration`,
            kind: "workflow",
            sourceUrl: `https://zapier.com/editor/${zap.id}`,
            environment: "production",
            ownerEmail: zap.owner?.email,
            aiServices,
            dataClassification: ["internal"],
            tags: ["zapier", "automation"],
            rawMetadata: {
              zapId: zap.id,
              status: zap.status,
              createdAt: zap.created_at,
              updatedAt: zap.updated_at,
              stepsCount: zap.steps?.length ?? 0,
              creatorEmail: zap.owner?.email,
            },
          })
        );
      }
    } catch (err) {
      errors.push({
        resource: "zaps",
        message: err instanceof Error ? err.message : String(err),
        recoverable: false,
      });
    }

    logger.info({ assets: assets.length }, "zapier: sync complete");
    return { assets, errors, metadata: { service: "zapier" } };
  }

  async quarantine(
    _connector: Connector,
    credentials: Record<string, string>,
    externalId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`https://api.zapier.com/v1/zaps/${externalId}`, {
        method: "PATCH",
        headers: {
          "X-API-Key": credentials.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "paused" }),
      });
      if (!res.ok) throw new Error(`Zapier returned ${res.status}`);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

interface ZapierZap {
  id: number;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  owner?: { email: string };
  steps?: Array<{ app?: { title: string } }>;
}

interface SyncError {
  resource: string;
  message: string;
  recoverable: boolean;
}
