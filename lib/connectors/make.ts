// ============================================================
// Make.com Connector
// ============================================================

import type { Connector, SyncResult, NormalizedAsset } from "../types/platform";
import type { NexusConnector } from "./base";
import { detectAIServices, buildNormalizedAsset } from "./base";
import { logger } from "../logger";

const AI_MODULE_PATTERNS = /openai|anthropic|google-ai|google-gemini|huggingface|cohere|stability|dall-e|whisper|langchain|ai21|groq/i;

export class MakeConnector implements NexusConnector {
  kind = "make" as const;
  displayName = "Make";
  description = "Discover AI scenarios in your Make (formerly Integromat) account";
  category = "automation" as const;
  icon = "workflow";

  async validate(credentials: Record<string, string>) {
    try {
      const zone = credentials.zone || "us1";
      const res = await fetch(`https://${zone}.make.com/api/v2/users/me`, {
        headers: { Authorization: `Token ${credentials.apiKey}` },
      });
      if (!res.ok) throw new Error(`Make returned ${res.status}`);
      return { valid: true };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async sync(_connector: Connector, credentials: Record<string, string>): Promise<SyncResult> {
    const zone = credentials.zone || "us1";
    const headers = { Authorization: `Token ${credentials.apiKey}` };
    const teamId = credentials.teamId;

    const assets: NormalizedAsset[] = [];
    const errors: SyncError[] = [];

    try {
      const teamParam = teamId ? `&teamId=${teamId}` : "";
      let offset = 0;
      let hasMore = true;

      while (hasMore && assets.length < 500) {
        const url = `https://${zone}.make.com/api/v2/scenarios?pg[limit]=100&pg[offset]=${offset}${teamParam}`;
        const res = await fetch(url, { headers });

        if (!res.ok) {
          if (res.status === 429) break;
          throw new Error(`Make returned ${res.status}`);
        }

        const data = await res.json();
        const scenarios = data.scenarios ?? [];

        for (const scenario of scenarios) {
          const blueprint = scenario.blueprint ?? {};
          const modules = flattenModules(blueprint);
          const moduleText = modules
            .map((m: Record<string, unknown>) =>
              `${m.module ?? ""} ${m.app ?? ""}`,
            )
            .join(" ");

          if (!AI_MODULE_PATTERNS.test(moduleText)) continue;

          const aiServices = detectAIServices(moduleText);

          assets.push(
            buildNormalizedAsset({
              externalId: String(scenario.id),
              name: scenario.name || `Scenario ${scenario.id}`,
              description: `Make.com scenario with AI modules`,
              kind: "workflow",
              sourceUrl: `https://${zone}.make.com/scenarios/${scenario.id}`,
              environment: scenario.islinked ? "production" : "development",
              aiServices,
              dataClassification: ["internal"],
              tags: ["make", "automation"],
              rawMetadata: {
                scenarioId: scenario.id,
                islinked: scenario.islinked,
                moduleCount: modules.length,
              },
            }),
          );
        }

        hasMore = scenarios.length === 100;
        offset += 100;
      }
    } catch (err) {
      errors.push({
        resource: "scenarios",
        message: err instanceof Error ? err.message : String(err),
        recoverable: false,
      });
    }

    logger.info({ assets: assets.length }, "make: sync complete");
    return { assets, errors, metadata: { service: "make", zone } };
  }
}

/** Recursively extract modules from a Make blueprint. */
function flattenModules(
  blueprint: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];
  const flow = (blueprint.flow as Array<Record<string, unknown>>) ?? [];

  for (const item of flow) {
    result.push(item);
    const routes = (item.routes as Array<Record<string, unknown>>) ?? [];
    for (const route of routes) {
      result.push(...flattenModules(route));
    }
  }

  return result;
}

interface SyncError {
  resource: string;
  message: string;
  recoverable: boolean;
}
