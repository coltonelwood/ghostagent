// ============================================================
// SDK Connector
// ============================================================

import type { Connector, SyncResult, NormalizedAsset, SDKReportPayload } from "../types/platform";
import type { NexusConnector } from "./base";
import { buildNormalizedAsset } from "./base";
import { logger } from "../logger";

export class SDKConnector implements NexusConnector {
  kind = "sdk" as const;
  displayName = "Internal SDK";
  description = "Self-report AI systems from your own codebase using the Spekris SDK";
  category = "internal" as const;
  icon = "code";

  async validate(_credentials: Record<string, string>) {
    // SDK key is managed at org level — always valid if present
    return { valid: true };
  }

  async sync(_connector: Connector, _credentials: Record<string, string>): Promise<SyncResult> {
    logger.info("sdk: sync is a no-op — assets arrive via POST /api/sdk/report");
    return {
      assets: [],
      errors: [],
      metadata: { note: "SDK assets are reported via API, not pulled" },
    };
  }

  /**
   * Normalize an incoming SDK report payload into NormalizedAsset[].
   * Called by the POST /api/sdk/report endpoint.
   */
  static normalizeSDKReport(payload: SDKReportPayload): NormalizedAsset[] {
    const source = payload.source ?? "sdk";

    return payload.assets.map((item) =>
      buildNormalizedAsset({
        externalId: item.externalId,
        name: item.name,
        description: item.description,
        kind: item.kind ?? "sdk_reported",
        sourceUrl: undefined,
        environment: item.environment ?? "unknown",
        ownerEmail: item.ownerEmail,
        aiServices: item.aiServices ?? [],
        dataClassification: item.dataClassification ?? [],
        tags: [...(item.tags ?? []), "sdk", source],
        rawMetadata: item.metadata ?? {},
      }),
    );
  }
}
