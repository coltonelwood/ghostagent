import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireRole, AuthError } from "@/lib/org-auth";
import { auditLog } from "@/lib/audit";
import { emitEvent } from "@/lib/event-system";
import { apiRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

async function loadAsset(id: string, orgId: string) {
  const db = getAdminClient();
  const { data } = await db
    .from("assets")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();
  return data;
}

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

      const asset = await loadAsset(id, auth.orgId);
      if (!asset) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const db = getAdminClient();
      const [historyRes, eventsRes, violationsRes, tasksRes] =
        await Promise.all([
          db
            .from("asset_history")
            .select("*")
            .eq("asset_id", id)
            .order("created_at", { ascending: false })
            .limit(10),
          db
            .from("events")
            .select("*")
            .eq("asset_id", id)
            .order("created_at", { ascending: false })
            .limit(10),
          db
            .from("policy_violations")
            .select("*, policies(name, severity)")
            .eq("asset_id", id)
            .order("first_detected_at", { ascending: false })
            .limit(10),
          db
            .from("tasks")
            .select("*")
            .eq("asset_id", id)
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

      return NextResponse.json({
        data: {
          ...asset,
          history: historyRes.data ?? [],
          events: eventsRes.data ?? [],
          violations: violationsRes.data ?? [],
          tasks: tasksRes.data ?? [],
        },
      });
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
      const auth = await requireRole("operator");

      const asset = await loadAsset(id, auth.orgId);
      if (!asset) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const body = (await req.json()) as {
        owner_email?: string;
        status?: string;
        tags?: string[];
        notes?: string;
      };

      const updates: Record<string, unknown> = {};
      if (body.owner_email !== undefined) updates.owner_email = body.owner_email;
      if (body.status !== undefined) updates.status = body.status;
      if (body.tags !== undefined) updates.tags = body.tags;
      if (body.notes !== undefined) updates.review_notes = body.notes;

      if (
        body.owner_email !== undefined &&
        body.owner_email !== asset.owner_email
      ) {
        await getAdminClient().from("ownership_history").insert({
          asset_id: id,
          org_id: auth.orgId,
          previous_owner_email: asset.owner_email,
          new_owner_email: body.owner_email,
          changed_by: auth.userId,
          reason: "manual_assignment",
        });
        updates.owner_status = "active_owner";
        updates.owner_confidence = 100;
        updates.owner_source = "explicit_assignment";

        await emitEvent({
          orgId: auth.orgId,
          kind: "owner_assigned",
          severity: "info",
          title: `Owner assigned: ${asset.name}`,
          body: `Owner changed to ${body.owner_email}`,
          assetId: id,
          actorId: auth.userId,
        });
      }

      const db = getAdminClient();
      const { data: updated, error } = await db
        .from("assets")
        .update({ ...updates, last_changed_at: new Date().toISOString() })
        .eq("id", id)
        .eq("org_id", auth.orgId) // defense-in-depth
        .select()
        .single();

      if (error) throw error;

      await auditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        actorEmail: auth.email,
        action: "asset.updated",
        resourceType: "asset",
        resourceId: id,
        metadata: { fields: Object.keys(updates) },
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
