import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { apiLogger } from "@/lib/logger";

type RouteHandler = (req: NextRequest, ctx?: unknown) => Promise<NextResponse>;

/**
 * Wraps an API route handler with:
 *   - Structured request/response logging (pino)
 *   - Global error catching (prevents unhandled rejections crashing the worker)
 *   - Request ID for trace correlation, echoed as x-request-id
 *   - Sentry error capture so unhandled exceptions actually show up in
 *     observability. The previous implementation swallowed the throw
 *     into a 500 response, which also swallowed it from Sentry.
 */
export function withLogging(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ctx?: unknown) => {
    const start = Date.now();
    const requestId = crypto.randomUUID().slice(0, 8);
    const method = req.method;
    const path = req.nextUrl.pathname;

    apiLogger.info({ requestId, method, path }, "→ request");

    try {
      const response = await handler(req, ctx);
      const duration = Date.now() - start;
      const status = response.status;

      if (status >= 400) {
        apiLogger.warn({ requestId, method, path, status, duration }, "← response error");
      } else {
        apiLogger.info({ requestId, method, path, status, duration }, "← response ok");
      }

      response.headers.set("x-request-id", requestId);
      return response;
    } catch (err) {
      const duration = Date.now() - start;
      const message = err instanceof Error ? err.message : "Unknown error";
      const stack = err instanceof Error ? err.stack : undefined;

      apiLogger.error(
        { requestId, method, path, duration, message, stack },
        "← unhandled error",
      );

      // Forward to Sentry with enough context to diagnose in prod. The
      // capture is no-op in development because Sentry is gated on
      // SENTRY_DSN being set.
      Sentry.captureException(err, {
        tags: { route: path, method, requestId },
        extra: { duration },
      });

      return NextResponse.json(
        { error: "Internal server error", requestId },
        { status: 500, headers: { "x-request-id": requestId } },
      );
    }
  };
}
