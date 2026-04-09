// ============================================================
// GCP Connector — Cloud Functions & Cloud Run AI Discovery
// ============================================================

import type { Connector, SyncResult, SyncError, NormalizedAsset } from "../types/platform";
import type { NexusConnector } from "./base";
import { detectAIServices, isAIRelated, buildNormalizedAsset } from "./base";
import { withRetry } from "../retry";
import logger from "../logger";

const log = logger.child({ module: "connector:gcp" });

// ---- JWT RS256 / OAuth Token Exchange ----

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson) as {
    client_email: string;
    private_key: string;
    token_uri: string;
    project_id: string;
  };

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");

  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Strip PEM headers and import the PKCS8 key
  const pemContents = sa.private_key
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/g, "")
    .replace(/-----END (RSA )?PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binaryKey = Buffer.from(pemContents, "base64");

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = Buffer.from(signature).toString("base64url");
  const jwt = `${unsignedToken}.${signatureB64}`;

  // Exchange the self-signed JWT for an access token
  const tokenRes = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    throw new Error(`GCP token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };
  return tokenData.access_token;
}

// ---- AI detection helpers ----

const AI_ENV_PATTERNS = /OPENAI|ANTHROPIC|VERTEX|PALM|GEMINI|HUGGING|LANGCHAIN|MODEL_ID|LLM|BEDROCK|COHERE/i;

function extractAIFromEnvVars(
  envVars: Record<string, string>
): Array<{ provider: string; purpose?: string }> {
  const services: Array<{ provider: string; purpose?: string }> = [];
  for (const key of Object.keys(envVars)) {
    if (AI_ENV_PATTERNS.test(key)) {
      services.push({ provider: key.toLowerCase().replace(/_/g, "-"), purpose: "env-var-detected" });
    }
  }
  return services;
}

function inferEnvironment(name: string): NormalizedAsset["environment"] {
  if (/prod/i.test(name)) return "production";
  if (/stag|stg/i.test(name)) return "staging";
  if (/dev|local|test/i.test(name)) return "development";
  return "unknown";
}

export class GCPConnector implements NexusConnector {
  kind = "gcp" as const;
  displayName = "Google Cloud";
  description = "Discover AI systems in Cloud Functions, Vertex AI, and Cloud Run";
  category = "cloud" as const;
  icon = "cloud";

  async validate(credentials: Record<string, string>) {
    try {
      const sa = JSON.parse(credentials.serviceAccountJson);

      if (!sa.client_email || !sa.private_key || !sa.project_id) {
        return {
          valid: false,
          error: "Service account JSON must contain client_email, private_key, and project_id",
        };
      }

      const token = await getAccessToken(credentials.serviceAccountJson);
      const res = await fetch(
        `https://cloudresourcemanager.googleapis.com/v1/projects/${sa.project_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        return { valid: false, error: `GCP auth succeeded but project access failed: ${res.status}` };
      }

      log.info({ project: sa.project_id }, "gcp: credentials valid");
      return { valid: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid JSON or credentials";
      return { valid: false, error: msg };
    }
  }

  async sync(connector: Connector, credentials: Record<string, string>): Promise<SyncResult> {
    const sa = JSON.parse(credentials.serviceAccountJson) as { project_id: string };
    const projectId = credentials.projectId ?? sa.project_id;

    const assets: NormalizedAsset[] = [];
    const errors: SyncError[] = [];

    log.info({ connectorId: connector.id, projectId }, "gcp: starting sync");

    let token: string;
    try {
      token = await getAccessToken(credentials.serviceAccountJson);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        assets: [],
        errors: [{ resource: "auth", message, recoverable: false }],
        metadata: {},
      };
    }

    const authHeaders = { Authorization: `Bearer ${token}` };

    // --- Cloud Functions (v2 API) ---
    try {
      let pageToken: string | undefined;
      do {
        let url = `https://cloudfunctions.googleapis.com/v2/projects/${projectId}/locations/-/functions?pageSize=50`;
        if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

        const res = await withRetry(
          () => fetch(url, { headers: authHeaders }),
          { label: "gcp:listFunctions", maxAttempts: 3 }
        );

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Cloud Functions API ${res.status}: ${body}`);
        }

        const data = (await res.json()) as {
          functions?: Array<{
            name: string;
            description?: string;
            buildConfig?: {
              runtime?: string;
              environmentVariables?: Record<string, string>;
            };
            serviceConfig?: {
              uri?: string;
              environmentVariables?: Record<string, string>;
            };
            updateTime?: string;
            state?: string;
          }>;
          nextPageToken?: string;
        };

        for (const fn of data.functions ?? []) {
          const envVars = {
            ...(fn.buildConfig?.environmentVariables ?? {}),
            ...(fn.serviceConfig?.environmentVariables ?? {}),
          };
          const aiFromEnv = extractAIFromEnvVars(envVars);
          const aiFromName = detectAIServices(fn.name + " " + (fn.description ?? ""));
          const allAI = [...aiFromEnv, ...aiFromName];

          if (allAI.length === 0 && !isAIRelated(fn.name)) continue;

          const shortName = fn.name.split("/").pop() ?? fn.name;
          const location = fn.name.split("/")[3] ?? "unknown";

          assets.push(
            buildNormalizedAsset({
              externalId: `gcp:function:${fn.name}`,
              name: shortName,
              description: fn.description ?? `Cloud Function in ${projectId}`,
              kind: "function",
              sourceUrl: `https://console.cloud.google.com/functions/details/${location}/${shortName}?project=${projectId}`,
              environment: inferEnvironment(shortName),
              aiServices: allAI.length ? allAI : [{ provider: "gcp" }],
              tags: ["gcp", "cloud-function", projectId],
              rawMetadata: {
                fullName: fn.name,
                runtime: fn.buildConfig?.runtime,
                state: fn.state,
                updateTime: fn.updateTime,
                envVarKeys: Object.keys(envVars),
              },
            })
          );
        }

        pageToken = data.nextPageToken;
      } while (pageToken);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ projectId, err: message }, "gcp: cloud functions list error");
      errors.push({ resource: "cloudfunctions:list", message, recoverable: false });
    }

    // --- Cloud Run Services ---
    try {
      let pageToken: string | undefined;
      do {
        let url = `https://run.googleapis.com/v2/projects/${projectId}/locations/-/services?pageSize=50`;
        if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

        const res = await withRetry(
          () => fetch(url, { headers: authHeaders }),
          { label: "gcp:listCloudRun", maxAttempts: 3 }
        );

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Cloud Run API ${res.status}: ${body}`);
        }

        const data = (await res.json()) as {
          services?: Array<{
            name: string;
            description?: string;
            uri?: string;
            template?: {
              containers?: Array<{
                image?: string;
                env?: Array<{ name: string; value?: string }>;
              }>;
            };
            updateTime?: string;
          }>;
          nextPageToken?: string;
        };

        for (const svc of data.services ?? []) {
          const containers = svc.template?.containers ?? [];
          const envVars: Record<string, string> = {};
          for (const c of containers) {
            for (const e of c.env ?? []) {
              envVars[e.name] = e.value ?? "";
            }
          }

          const aiFromEnv = extractAIFromEnvVars(envVars);
          const imageText = containers.map((c) => c.image ?? "").join(" ");
          const aiFromImage = detectAIServices(imageText + " " + svc.name + " " + (svc.description ?? ""));
          const allAI = [...aiFromEnv, ...aiFromImage];

          if (allAI.length === 0 && !isAIRelated(svc.name)) continue;

          const shortName = svc.name.split("/").pop() ?? svc.name;
          const location = svc.name.split("/")[3] ?? "unknown";

          assets.push(
            buildNormalizedAsset({
              externalId: `gcp:cloudrun:${svc.name}`,
              name: shortName,
              description: svc.description ?? `Cloud Run service in ${projectId}`,
              kind: "api",
              sourceUrl: `https://console.cloud.google.com/run/detail/${location}/${shortName}?project=${projectId}`,
              environment: inferEnvironment(shortName),
              aiServices: allAI.length ? allAI : [{ provider: "gcp" }],
              tags: ["gcp", "cloud-run", projectId],
              rawMetadata: {
                fullName: svc.name,
                uri: svc.uri,
                updateTime: svc.updateTime,
                images: containers.map((c) => c.image),
                envVarKeys: Object.keys(envVars),
              },
            })
          );
        }

        pageToken = data.nextPageToken;
      } while (pageToken);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn({ projectId, err: message }, "gcp: cloud run list error");
      errors.push({ resource: "cloudrun:list", message, recoverable: true });
    }

    log.info(
      { connectorId: connector.id, projectId, assetsFound: assets.length, errorsCount: errors.length },
      "gcp: sync complete"
    );

    return { assets, errors, metadata: { projectId } };
  }
}
