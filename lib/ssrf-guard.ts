/**
 * ssrf-guard.ts
 *
 * SSRF (Server-Side Request Forgery) protection for any connector
 * or user-supplied URL that the server fetches.
 *
 * Blocks: localhost, RFC-1918 private ranges, link-local, loopback,
 * metadata endpoints (AWS/GCP/Azure IMDSv1), and non-HTTPS schemes.
 */

import { logger, logSSRFBlocked } from "./logger";

// Allowed hostnames for known connectors (strict allowlist for user-supplied base URLs)
const ALLOWED_HOSTNAMES: Record<string, RegExp> = {
  gitlab:      /^(gitlab\.com|[a-z0-9.-]+\.gitlab\.com)$/i,
  n8n:         /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i, // any valid public hostname
  slack:       /^hooks\.slack\.com$/i,
  bamboohr:    /^api\.bamboohr\.com$/i,
  rippling:    /^api\.rippling\.com$/i,
  workday:     /^[a-z0-9-]+\.workday\.com$/i,
};

// Blocked IP ranges and hostnames
const BLOCKED_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,         // IPv4 loopback
  /^::1$/,                         // IPv6 loopback
  /^0\.0\.0\.0$/,                  // Unspecified
  /^10\.\d+\.\d+\.\d+$/,          // RFC-1918 Class A
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/, // RFC-1918 Class B
  /^192\.168\.\d+\.\d+$/,         // RFC-1918 Class C
  /^169\.254\.\d+\.\d+$/,         // Link-local (AWS metadata)
  /^fd[0-9a-f]{2}:/i,             // IPv6 ULA
  /^fe80:/i,                       // IPv6 link-local
  /^100\.64\.\d+\.\d+$/,          // CGNAT range
  /^metadata\.google\.internal$/i, // GCP metadata
  /^metadata\.azure\.internal$/i,  // Azure metadata
];

// Known cloud metadata paths to block even on valid hostnames
const BLOCKED_PATHS = [
  /^\/latest\/meta-data/i,         // AWS IMDSv1
  /^\/computeMetadata\//i,         // GCP metadata
  /^\/metadata\//i,                // Azure metadata
];

export class SSRFError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SSRFError";
  }
}

/**
 * Validate a user-supplied URL before the server fetches it.
 * Throws SSRFError if the URL is blocked.
 *
 * @param rawUrl - The URL to validate
 * @param connectorKind - Optional: if set, validates against connector-specific allowlist
 */
export function validateUrl(rawUrl: string, connectorKind?: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SSRFError(`Invalid URL: ${rawUrl}`);
  }

  // Enforce HTTPS only
  if (url.protocol !== "https:") {
    throw new SSRFError(`Only HTTPS URLs are allowed. Got: ${url.protocol}`);
  }

  const hostname = url.hostname.toLowerCase();

  // Block known internal patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(hostname)) {
      logSSRFBlocked({ url: rawUrl, connectorKind });
      throw new SSRFError(`URL resolves to a private or internal address`);
    }
  }

  // Block known metadata paths
  for (const pattern of BLOCKED_PATHS) {
    if (pattern.test(url.pathname)) {
      logSSRFBlocked({ url: rawUrl, connectorKind });
      throw new SSRFError(`URL path is not allowed`);
    }
  }

  // If a connector kind is specified, enforce its allowlist
  if (connectorKind && connectorKind in ALLOWED_HOSTNAMES) {
    const allowed = ALLOWED_HOSTNAMES[connectorKind];
    if (!allowed.test(hostname)) {
      // For generic connectors (n8n), we just verify it's a valid public hostname
      if (connectorKind === "n8n") {
        // Extra check: reject if it looks like an IP address
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
          throw new SSRFError(`IP address URLs are not allowed for ${connectorKind}`);
        }
      } else {
        throw new SSRFError(`Hostname "${hostname}" is not allowed for ${connectorKind} connector`);
      }
    }
  }

  return url;
}

/**
 * Validate a Slack webhook URL specifically.
 * Must be exactly https://hooks.slack.com/...
 */
export function validateSlackWebhookUrl(url: string): void {
  validateUrl(url, "slack");
}

/**
 * Validate a generic webhook/alert URL (user-configured).
 * Must be HTTPS, not private, path not metadata.
 */
export function validateWebhookUrl(url: string): void {
  validateUrl(url);
}
