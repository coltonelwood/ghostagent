import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { requireAuth, requireRole, AuthError } from "@/lib/org-auth";
import { apiRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";
import { getDeployment, rollbackCountermeasure } from "@/lib/threat-intelligence";

export const dynamic = "force-dynamic";

export const GET = withLogging(
  async (_req: NextRequest, ctx: unknown) => {
    try {
      const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
      const auth = await requireAuth();

      const rl = apiRateLimiter.check(auth.userId);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
        );
      }

      const deployment = await getDeployment(id, auth.orgId);
      if (!deployment) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      return NextResponse.json({ data: deployment });
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  },
);

export const PATCH = withLogging(
  async (req: NextRequest, ctx: unknown) => {
    try {
      const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
      const auth = await requireRole("admin");

      const rl = apiRateLimiter.check(auth.userId);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
        );
      }

      let body: { action: string; reason: string };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          { error: "Request body must be JSON." },
          { status: 400 },
        );
      }

      if (body.action !== "rollback") {
        return NextResponse.json(
          { error: "Action must be 'rollback'." },
          { status: 400 },
        );
      }

      if (!body.reason || typeof body.reason !== "string" || body.reason.trim().length === 0) {
        return NextResponse.json(
          { error: "A rollback reason is required." },
          { status: 400 },
        );
      }

      const result = await rollbackCountermeasure(id, auth.orgId, body.reason);
      if (!result.success) {
        return NextResponse.json(
          { error: "Failed to rollback. Deployment may not exist or is already inactive." },
          { status: 400 },
        );
      }

      return NextResponse.json({ data: { id, status: "rolled_back" } });
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  },
);
