// ============================================================
// Azure Connector
// ============================================================

import type { Connector, SyncResult, NormalizedAsset } from "../types/platform";
import type { NexusConnector } from "./base";
import { detectAIServices, buildNormalizedAsset } from "./base";
import { withRetry } from "../retry";
import { logger } from "../logger";

const AI_NAME_PATTERNS = /openai|cognitive|ml-|ai-|langchain|anthropic|huggingface|inference/i;

async function getAzureToken(
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const res = await withRetry(
    () =>
      fetch(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
            scope: "https://management.azure.com/.default",
          }),
        },
      ),
    { label: "azure:token" },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Azure token request failed: HTTP ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

export class AzureConnector implements NexusConnector {
  kind = "azure" as const;
  displayName = "Azure";
  description = "Discover AI systems in Azure Functions, Azure OpenAI, and Logic Apps";
  category = "cloud" as const;
  icon = "cloud";

  async validate(credentials: Record<string, string>) {
    const { tenantId, clientId, clientSecret } = credentials;

    if (!tenantId || !clientId || !clientSecret) {
      return { valid: false, error: "tenantId, clientId, and clientSecret are required" };
    }

    try {
      await getAzureToken(tenantId, clientId, clientSecret);
      return { valid: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { valid: false, error: msg };
    }
  }

  async sync(_connector: Connector, credentials: Record<string, string>): Promise<SyncResult> {
    const { tenantId, clientId, clientSecret, subscriptionId } = credentials;

    const assets: NormalizedAsset[] = [];
    const errors: SyncError[] = [];

    let token: string;
    try {
      token = await getAzureToken(tenantId, clientId, clientSecret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        assets: [],
        errors: [{ resource: "auth", message: msg, recoverable: false }],
        metadata: {},
      };
    }

    const headers = { Authorization: `Bearer ${token}` };

    if (!subscriptionId) {
      return {
        assets: [],
        errors: [{ resource: "subscription", message: "No subscriptionId provided", recoverable: false }],
        metadata: {},
      };
    }

    // --- Azure Functions / Web Apps ---
    try {
      const url = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.Web/sites?api-version=2022-03-01`;
      const res = await withRetry(
        () => fetch(url, { headers }),
        { label: "azure:functions:list" },
      );

      if (!res.ok) throw new Error(`Azure returned ${res.status}`);

      const data = await res.json();
      const sites = data.value ?? [];

      for (const site of sites) {
        const name: string = site.name ?? "";
        if (!AI_NAME_PATTERNS.test(name)) continue;

        const aiServices = detectAIServices(name);

        assets.push(
          buildNormalizedAsset({
            externalId: site.id ?? `azure:${subscriptionId}:${name}`,
            name: site.name,
            description: `Azure Function/App: ${site.name}`,
            kind: "function",
            sourceUrl: `https://portal.azure.com/#resource${site.id}`,
            environment: site.properties?.state === "Running" ? "production" : "unknown",
            aiServices: aiServices.length ? aiServices : [{ provider: "azure" }],
            dataClassification: [],
            tags: ["azure", site.kind ?? "functionapp"],
            rawMetadata: {
              resourceGroup: site.properties?.resourceGroup,
              location: site.location,
              kind: site.kind,
              state: site.properties?.state,
            },
          }),
        );
      }
    } catch (err) {
      errors.push({
        resource: "functions:list",
        message: err instanceof Error ? err.message : String(err),
        recoverable: true,
      });
    }

    // --- Azure Cognitive Services / OpenAI ---
    try {
      const url = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.CognitiveServices/accounts?api-version=2023-05-01`;
      const res = await withRetry(
        () => fetch(url, { headers }),
        { label: "azure:cognitive:list" },
      );

      if (!res.ok) throw new Error(`Azure returned ${res.status}`);

      const data = await res.json();
      for (const account of data.value ?? []) {
        assets.push(
          buildNormalizedAsset({
            externalId: account.id ?? `azure:cognitive:${account.name}`,
            name: account.name,
            description: `Azure Cognitive Service: ${account.kind ?? "unknown"}`,
            kind: "integration",
            sourceUrl: `https://portal.azure.com/#resource${account.id}`,
            environment: "production",
            aiServices: [{ provider: "azure-cognitive", model: account.kind }],
            dataClassification: [],
            tags: ["azure", "cognitive-services", account.kind ?? ""],
            rawMetadata: {
              kind: account.kind,
              sku: account.sku,
              location: account.location,
            },
          }),
        );
      }
    } catch (err) {
      errors.push({
        resource: "cognitive:list",
        message: err instanceof Error ? err.message : String(err),
        recoverable: true,
      });
    }

    logger.info({ subscriptionId, assets: assets.length }, "azure: sync complete");
    return { assets, errors, metadata: { subscriptionId } };
  }
}

interface SyncError {
  resource: string;
  message: string;
  recoverable: boolean;
}
