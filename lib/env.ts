/**
 * Validates required environment variables at startup.
 * Fails fast with a clear error rather than cryptic runtime failures.
 *
 * Call this from instrumentation.ts (server-side only).
 */

const REQUIRED_SERVER_ENV: string[] = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRO_PRICE_ID",
  "NEXT_PUBLIC_APP_URL",
  "INTERNAL_API_KEY",
  "ENCRYPTION_KEY",  // Required for connector credential encryption
];

// These are optional at startup but required for specific features
const OPTIONAL_ENV: string[] = [
  "RESEND_API_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
];

export function validateEnv(): void {
  const missing = REQUIRED_SERVER_ENV.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const msg = `Missing required environment variables: ${missing.join(", ")}`;
    console.error(`[env] FATAL: ${msg}`);
    // In production, throw to prevent starting with a broken config
    if (process.env.NODE_ENV === "production") {
      throw new Error(msg);
    } else {
      console.warn(`[env] WARNING: ${msg} (continuing in development)`);
    }
  }

  const missingOptional = OPTIONAL_ENV.filter((key) => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn(`[env] Optional env vars not set: ${missingOptional.join(", ")}`);
  }
}
