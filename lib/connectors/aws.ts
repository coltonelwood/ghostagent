import type { Connector, SyncResult, NormalizedAsset } from "../types/platform";
import type { NexusConnector } from "./base";
import { detectAIServices, buildNormalizedAsset } from "./base";
import { logger } from "../logger";

// AWS connector uses AWS Signature V4 signing via fetch.
// Required IAM permissions (read-only, least-privilege):
//   lambda:ListFunctions, lambda:GetFunction
//   apigateway:GET
//   cloudtrail:LookupEvents (optional, for AI API call detection)

const AI_ENV_PATTERNS = /openai|anthropic|bedrock|sagemaker|vertex|llm|gpt|claude|gemini/i;
const AI_LAYER_PATTERNS = /langchain|openai|anthropic|llama/i;

export class AWSConnector implements NexusConnector {
  kind = "aws" as const;
  displayName = "AWS";
  description = "Discover AI systems in Lambda, API Gateway, and Bedrock";
  category = "cloud" as const;
  icon = "cloud";

  async validate(credentials: Record<string, string>) {
    try {
      // Test by listing Lambda functions (minimal permission needed)
      await this.lambdaRequest(credentials, "GET", "/2015-03-31/functions?MaxItems=1");
      return { valid: true };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async sync(connector: Connector, credentials: Record<string, string>): Promise<SyncResult> {
    const assets: NormalizedAsset[] = [];
    const errors: SyncError[] = [];

    // Scan Lambda functions
    try {
      const functions = await this.listLambdaFunctions(credentials);
      for (const fn of functions) {
        const aiServices = this.detectLambdaAIServices(fn);
        if (!aiServices.length) continue;

        assets.push(
          buildNormalizedAsset({
            externalId: fn.FunctionArn ?? fn.FunctionName,
            name: fn.FunctionName,
            description: fn.Description || `Lambda function in ${credentials.region}`,
            kind: "function",
            sourceUrl: `https://console.aws.amazon.com/lambda/home?region=${credentials.region}#/functions/${fn.FunctionName}`,
            environment: inferEnvFromName(fn.FunctionName),
            ownerEmail: fn.Tags?.["owner"] ?? fn.Tags?.["Owner"] ?? undefined,
            aiServices,
            dataClassification: inferDataClassificationFromTags(fn.Tags ?? {}),
            tags: ["aws", "lambda"],
            rawMetadata: {
              functionArn: fn.FunctionArn,
              runtime: fn.Runtime,
              region: credentials.region,
              lastModified: fn.LastModified,
              memorySize: fn.MemorySize,
              timeout: fn.Timeout,
              ownerTag: fn.Tags?.["owner"] ?? fn.Tags?.["Owner"],
            },
          })
        );
      }
    } catch (err) {
      errors.push({
        resource: "lambda",
        message: err instanceof Error ? err.message : String(err),
        recoverable: false,
      });
    }

    logger.info({ region: credentials.region, assets: assets.length }, "aws: sync complete");
    return { assets, errors, metadata: { region: credentials.region } };
  }

  private async listLambdaFunctions(credentials: Record<string, string>): Promise<LambdaFunction[]> {
    const functions: LambdaFunction[] = [];
    let marker: string | undefined;

    do {
      const url = `/2015-03-31/functions?MaxItems=50${marker ? `&Marker=${marker}` : ""}`;
      const data = await this.lambdaRequest(credentials, "GET", url) as { Functions?: LambdaFunction[]; NextMarker?: string };
      functions.push(...(data.Functions ?? []));
      marker = data.NextMarker;
    } while (marker && functions.length < 500);

    return functions;
  }

  private detectLambdaAIServices(fn: LambdaFunction): Array<{ provider: string }> {
    const text = [
      fn.FunctionName,
      fn.Description ?? "",
      Object.values(fn.Environment?.Variables ?? {}).join(" "),
      (fn.Layers ?? []).map((l) => l.Arn).join(" "),
    ].join(" ");

    if (!AI_ENV_PATTERNS.test(text) && !AI_LAYER_PATTERNS.test(text)) return [];
    return detectAIServices(text);
  }

  // AWS Signature V4 — lightweight implementation using built-in crypto
  private async lambdaRequest(
    credentials: Record<string, string>,
    method: string,
    path: string
  ): Promise<unknown> {
    const { accessKeyId, secretAccessKey, region } = credentials;
    const service = "lambda";
    const host = `lambda.${region}.amazonaws.com`;
    const url = `https://${host}${path}`;

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
    const dateStamp = amzDate.slice(0, 8);

    const canonicalRequest = [
      method,
      path.split("?")[0],
      path.includes("?") ? path.split("?")[1] : "",
      `host:${host}\nx-amz-date:${amzDate}\n`,
      "host;x-amz-date",
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", // SHA256 of empty body
    ].join("\n");

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      await sha256Hex(canonicalRequest),
    ].join("\n");

    const signingKey = await getSigningKey(secretAccessKey, dateStamp, region, service);
    const signature = await hmacHex(signingKey, stringToSign);

    const authHeader = [
      `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}`,
      `SignedHeaders=host;x-amz-date`,
      `Signature=${signature}`,
    ].join(", ");

    const res = await fetch(url, {
      method,
      headers: {
        Host: host,
        "X-Amz-Date": amzDate,
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AWS ${service} returned ${res.status}: ${text.slice(0, 200)}`);
    }

    return res.json();
  }
}

async function sha256Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacRaw(key: BufferSource | CryptoKey, message: string): Promise<ArrayBuffer> {
  const cryptoKey = key instanceof CryptoKey ? key : await crypto.subtle.importKey(
    "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
}

async function hmacHex(key: BufferSource | CryptoKey, message: string): Promise<string> {
  const buffer = await hmacRaw(key, message);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getSigningKey(secret: string, date: string, region: string, service: string): Promise<CryptoKey> {
  const kDate = await hmacRaw(new TextEncoder().encode("AWS4" + secret), date);
  const kRegion = await hmacRaw(kDate, region);
  const kService = await hmacRaw(kRegion, service);
  const kSigning = await hmacRaw(kService, "aws4_request");
  return crypto.subtle.importKey("raw", kSigning, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

interface LambdaFunction {
  FunctionName: string;
  FunctionArn?: string;
  Description?: string;
  Runtime?: string;
  LastModified?: string;
  MemorySize?: number;
  Timeout?: number;
  Environment?: { Variables?: Record<string, string> };
  Layers?: Array<{ Arn: string }>;
  Tags?: Record<string, string>;
}

interface SyncError {
  resource: string;
  message: string;
  recoverable: boolean;
}

function inferEnvFromName(name: string): NormalizedAsset["environment"] {
  if (/prod/i.test(name)) return "production";
  if (/stag|staging/i.test(name)) return "staging";
  if (/dev|local|test/i.test(name)) return "development";
  return "unknown";
}

function inferDataClassificationFromTags(tags: Record<string, string>): string[] {
  const dc = tags["data-classification"] || tags["DataClassification"] || "";
  if (/phi|health/i.test(dc)) return ["phi"];
  if (/pii|personal/i.test(dc)) return ["pii"];
  if (/financial/i.test(dc)) return ["financial"];
  if (/public/i.test(dc)) return ["public"];
  return ["internal"];
}
