/**
 * Next.js instrumentation hook — runs once on server startup.
 * Used for environment validation and Sentry initialization.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Validate env on startup (server-side only)
    const { validateEnv } = await import("@/lib/env");
    validateEnv();

    // Initialize Sentry
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
