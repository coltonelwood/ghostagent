import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireRole, AuthError } from "@/lib/org-auth";
import { syncConnector } from "@/lib/sync-orchestrator";
import { apiRateLimiter, syncRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export const POST = withLogging(
  async (_req: NextRequest, ctx: unknown) => {
    try {
      const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
      const auth = await requireRole("operator");

      // Both limits use the distributed backend when Upstash is
      // configured so a multi-instance deploy can't be bypassed by
      // hammering different Vercel regions.
      const rl = await apiRateLimiter.checkAsync(auth.userId);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
        );
      }

      // Per-connector sync throttle: max 1 manual sync per 5 minutes
      const syncRl = await syncRateLimiter.checkAsync(id);
      if (!syncRl.allowed) {
        return NextResponse.json(
          { error: "This connector was synced recently. Please wait before syncing again." },
          { status: 429, headers: rateLimitHeaders(syncRl.remaining, syncRl.resetAt) },
        );
      }

      const db = getAdminClient();
      const { data: connector } = await db
        .from("connectors")
        .select("id, org_id, status")
        .eq("id", id)
        .eq("org_id", auth.orgId)
        .single();

      if (!connector) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      if (connector.status === "disconnected") {
        return NextResponse.json(
          { error: "Connector is disconnected" },
          { status: 400 },
        );
      }

      // Run sync in the background. `after()` keeps the Vercel function
      // alive until the promise resolves while letting the user response
      // go out immediately. syncConnector is expected to write a failure
      // row on its own error path so the UI can display a clear state.
      after(
        syncConnector(id).catch((err) =>
          logger.error({ connectorId: id, err }, "background sync failed"),
        ),
      );

      return NextResponse.json({ success: true, message: "Sync started" });
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  },
);
