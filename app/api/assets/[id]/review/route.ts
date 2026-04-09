import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireRole, AuthError } from "@/lib/org-auth";
import { auditLog } from "@/lib/audit";
import { apiRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export const POST = withLogging(
  async (req: NextRequest, ctx: unknown) => {
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

      const db = getAdminClient();
      const { data: asset } = await db
        .from("assets")
        .select("*")
        .eq("id", id)
        .eq("org_id", auth.orgId)
        .single();

      if (!asset) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const body = (await req.json()) as { notes?: string };
      const now = new Date().toISOString();

      const { data: updated, error } = await db
        .from("assets")
        .update({
          review_status: "reviewed",
          reviewed_by: auth.userId,
          reviewed_at: now,
          review_notes: body.notes ?? null,
          last_changed_at: now,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Create asset_history entry
      await db.from("asset_history").insert({
        asset_id: id,
        org_id: auth.orgId,
        changed_by: auth.userId,
        change_type: "reviewed",
        previous_state: { review_status: asset.review_status },
        new_state: { review_status: "reviewed", reviewed_by: auth.userId, reviewed_at: now },
      });

      await auditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        actorEmail: auth.email,
        action: "asset.reviewed",
        resourceType: "asset",
        resourceId: id,
        metadata: { notes: body.notes },
        req,
      });

      return NextResponse.json({ data: updated });
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  },
);
