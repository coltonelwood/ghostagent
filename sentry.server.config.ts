import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  enabled: !!process.env.SENTRY_DSN,

  beforeSend(event) {
    // Scrub sensitive fields from error reports
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>;
      if (data.github_token) data.github_token = "[REDACTED]";
      if (data.password) data.password = "[REDACTED]";
    }
    return event;
  },
});
