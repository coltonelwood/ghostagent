import { NextRequest, NextResponse } from "next/server";
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

      const rl = apiRateLimiter.check(auth.userId);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
        );
      }

      // Per-connector sync throttle: max 1 manual sync per 5 minutes
      const syncRl = syncRateLimiter.check(id); // keyed on connector ID, not user
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

      // Fire-and-forget async sync
      syncConnector(id).catch(() => {});

      return NextResponse.json({ success: true, message: "Sync started" });
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  },
);
