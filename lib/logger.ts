import pino from "pino";

const isDev = process.env.NODE_ENV === "development";
const isEdge = typeof process.env.NEXT_RUNTIME === "string" && process.env.NEXT_RUNTIME === "edge";

// Edge runtime doesn't support pino transports
const logger = isEdge
  ? pino({ level: "info" })
  : pino({
      level: process.env.LOG_LEVEL ?? "info",
      ...(isDev
        ? {
            transport: {
              target: "pino-pretty",
              options: { colorize: true, ignore: "pid,hostname" },
            },
          }
        : {
            // Production: JSON to stdout (Vercel captures this)
            formatters: {
              level(label) {
                return { level: label };
              },
            },
          }),
    });

export default logger;
export { logger };

// Scoped child loggers for each domain
export const apiLogger = logger.child({ module: "api" });
export const scanLogger = logger.child({ module: "scanner" });
export const authLogger = logger.child({ module: "auth" });
export const stripeLogger = logger.child({ module: "stripe" });
export const securityLogger = logger.child({ module: "security" });

// ─── SECURITY EVENT HELPERS ───────────────────────────────────────────────
// These emit structured log lines searchable as event_type="security.*"
// for Datadog / Vercel Log Drains / SIEM ingestion.

/** Auth failure (wrong password, expired session, invalid token) */
export function logAuthFailure(ctx: { userId?: string; ip?: string; reason: string; path?: string }) {
  securityLogger.warn({ event_type: "security.auth_failure", ...redact(ctx) }, "auth failure");
}

/** Privilege escalation attempt (user tried to access a higher role endpoint) */
export function logPrivescAttempt(ctx: { userId: string; orgId: string; required: string; actual: string; path: string }) {
  securityLogger.error({ event_type: "security.privesc_attempt", ...redact(ctx) }, "privilege escalation attempt");
}

/** Cross-tenant access attempt (org_id mismatch) */
export function logCrossTenantAttempt(ctx: { userId: string; requestedOrgId: string; actualOrgId: string; resource: string }) {
  securityLogger.error({ event_type: "security.cross_tenant", ...redact(ctx) }, "cross-tenant access attempt");
}

/** Webhook signature failure */
export function logWebhookFailure(ctx: { source: string; reason: string; ip?: string }) {
  securityLogger.warn({ event_type: "security.webhook_sig_fail", ...ctx }, "webhook signature failure");
}

/** Rate limit exceeded (possible abuse) */
export function logRateLimitExceeded(ctx: { userId?: string; ip?: string; limiter: string; path: string }) {
  securityLogger.warn({ event_type: "security.rate_limit", ...redact(ctx) }, "rate limit exceeded");
}

/** SSRF attempt blocked */
export function logSSRFBlocked(ctx: { url: string; connectorKind?: string; orgId?: string }) {
  securityLogger.error({ event_type: "security.ssrf_blocked", url: ctx.url, connectorKind: ctx.connectorKind, orgId: ctx.orgId }, "SSRF attempt blocked");
}

/** Connector credential access (for audit trail) */
export function logCredentialAccess(ctx: { userId: string; orgId: string; connectorId: string; action: "decrypt" | "encrypt" | "delete" }) {
  securityLogger.info({ event_type: "security.credential_access", ...ctx }, "connector credential accessed");
}

// Redact sensitive values from log objects
const SENSITIVE_KEYS = /password|secret|token|credential|apiKey|api_key|authorization|key|privateKey/i;
function redact<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj } as Record<string, unknown>;
  for (const k of Object.keys(out)) {
    if (SENSITIVE_KEYS.test(k)) out[k] = "[REDACTED]";
  }
  return out as T;
}
