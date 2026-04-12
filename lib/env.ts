/**
 * Validates required environment variables at startup.
 * Fails fast with a clear error rather than cryptic runtime failures.
 *
 * Call this from instrumentation.ts (server-side only).
 */

/** Required for the app to boot at all. */
const REQUIRED_SERVER_ENV: readonly string[] = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRO_PRICE_ID",
  "NEXT_PUBLIC_APP_URL",
  "INTERNAL_API_KEY",
  "CRON_SECRET",
  "ENCRYPTION_KEY",
];

/** Optional — features degrade gracefully if missing. */
const OPTIONAL_ENV: readonly string[] = [
  "RESEND_API_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "SENTRY_DSN",
];

interface EnvProblem {
  key: string;
  reason: string;
}

function validateShapes(): EnvProblem[] {
  const problems: EnvProblem[] = [];

  // ENCRYPTION_KEY must be 64 hex characters (32 bytes).
  const encKey = process.env.ENCRYPTION_KEY;
  if (encKey && !/^[0-9a-fA-F]{64}$/.test(encKey)) {
    problems.push({
      key: "ENCRYPTION_KEY",
      reason: "must be exactly 64 hex characters (32 bytes). Generate with `openssl rand -hex 32`.",
    });
  }

  // INTERNAL_API_KEY must be at least 24 chars to be cryptographically useful.
  const internal = process.env.INTERNAL_API_KEY;
  if (internal && internal.length < 24) {
    problems.push({
      key: "INTERNAL_API_KEY",
      reason: "must be at least 24 characters. Generate with `openssl rand -hex 32`.",
    });
  }

  // CRON_SECRET same — guards internal cron endpoints from public access.
  const cron = process.env.CRON_SECRET;
  if (cron && cron.length < 24) {
    problems.push({
      key: "CRON_SECRET",
      reason: "must be at least 24 characters.",
    });
  }

  // NEXT_PUBLIC_APP_URL must be a real URL and not a localhost fallback in prod.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      const parsed = new URL(appUrl);
      if (
        process.env.NODE_ENV === "production" &&
        /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(parsed.hostname)
      ) {
        problems.push({
          key: "NEXT_PUBLIC_APP_URL",
          reason: `points at ${parsed.hostname} in production — set it to your real domain (e.g. https://nexus.yourcompany.com).`,
        });
      }
      if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
        problems.push({
          key: "NEXT_PUBLIC_APP_URL",
          reason: "must use HTTPS in production.",
        });
      }
    } catch {
      problems.push({
        key: "NEXT_PUBLIC_APP_URL",
        reason: "is not a valid URL.",
      });
    }
  }

  // STRIPE_SECRET_KEY sanity check.
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey && !/^sk_(test|live)_/.test(stripeKey)) {
    problems.push({
      key: "STRIPE_SECRET_KEY",
      reason: "doesn't start with `sk_test_` or `sk_live_` — double-check you copied the secret key, not the publishable key.",
    });
  }

  // Warn if using test Stripe key in production.
  if (
    process.env.NODE_ENV === "production" &&
    stripeKey &&
    stripeKey.startsWith("sk_test_")
  ) {
    problems.push({
      key: "STRIPE_SECRET_KEY",
      reason: "is a test key but NODE_ENV is production. Real customers will not be billed.",
    });
  }

  return problems;
}

export function validateEnv(): void {
  const missing = REQUIRED_SERVER_ENV.filter((key) => !process.env[key]);
  const shapeProblems = validateShapes();

  const hardFailures: string[] = [];
  if (missing.length > 0) {
    hardFailures.push(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }
  for (const p of shapeProblems) {
    hardFailures.push(`${p.key} ${p.reason}`);
  }

  if (hardFailures.length > 0) {
    const msg = hardFailures.join("\n  - ");
    console.error(`[env] FATAL:\n  - ${msg}`);
    if (process.env.NODE_ENV === "production") {
      // In production we refuse to start — better than silent drift.
      throw new Error(
        `Nexus cannot start with invalid environment:\n  - ${msg}`,
      );
    } else {
      console.warn(
        `[env] WARNING: continuing in development with invalid env. Real customers would see failures.`,
      );
    }
  }

  const missingOptional = OPTIONAL_ENV.filter((key) => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn(
      `[env] Optional env vars not set (features degrade gracefully): ${missingOptional.join(", ")}`,
    );
  }

  // In production, in-memory rate limiting is fragile across multiple Vercel
  // instances. Warn loudly if no Redis URL is configured so the operator
  // knows to expect per-instance inconsistency.
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.UPSTASH_REDIS_REST_URL
  ) {
    console.warn(
      "[env] WARNING: UPSTASH_REDIS_REST_URL is not set. Rate limiting is in-memory per instance and will be bypassable under autoscale. Configure Upstash Redis before launch.",
    );
  }
}
