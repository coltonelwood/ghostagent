import { NextRequest, NextResponse } from "next/server";
import { apiLogger } from "@/lib/logger";

type RouteHandler = (req: NextRequest, ctx?: unknown) => Promise<NextResponse>;

/**
 * Wraps an API route handler with:
 * - Structured request/response logging
 * - Global error catching (prevents unhandled rejections crashing the worker)
 * - Request ID for trace correlation
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

      // Attach request ID to response for debugging
      response.headers.set("x-request-id", requestId);
      return response;
    } catch (err) {
      const duration = Date.now() - start;
      const message = err instanceof Error ? err.message : "Unknown error";
      const stack = err instanceof Error ? err.stack : undefined;

      apiLogger.error({ requestId, method, path, duration, message, stack }, "← unhandled error");

      return NextResponse.json(
        { error: "Internal server error", requestId },
        { status: 500, headers: { "x-request-id": requestId } }
      );
    }
  };
}
