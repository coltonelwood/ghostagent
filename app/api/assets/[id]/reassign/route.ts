import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireRole, AuthError } from "@/lib/org-auth";
import { auditLog } from "@/lib/audit";
import { emitEvent } from "@/lib/event-system";
import { apiRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const handler = withLogging(
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

      const body = (await req.json()) as {
        ownerEmail?: string;
        owner_email?: string;
        reason?: string;
      };

      const newOwner = body.ownerEmail || body.owner_email;
      if (!newOwner) {
        return NextResponse.json(
          { error: "owner_email is required" },
          { status: 400 },
        );
      }

      const now = new Date().toISOString();

      // Update asset ownership
      const { data: updated, error } = await db
        .from("assets")
        .update({
          owner_email: newOwner,
          owner_status: "active_owner",
          owner_confidence: 100,
          owner_source: "manual_assignment",
          last_changed_at: now,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Create ownership_history entry
      await db.from("ownership_history").insert({
        asset_id: id,
        org_id: auth.orgId,
        previous_owner_email: asset.owner_email,
        new_owner_email: newOwner,
        changed_by: auth.userId,
        reason: body.reason ?? "manual_reassignment",
      });

      // Emit owner_changed event
      await emitEvent({
        orgId: auth.orgId,
        kind: "owner_assigned",
        severity: "info",
        title: `Owner reassigned: ${asset.name}`,
        body: `Owner changed from ${asset.owner_email ?? "unassigned"} to ${newOwner}`,
        metadata: {
          previousOwner: asset.owner_email,
          newOwner,
          reason: body.reason,
        },
        assetId: id,
        actorId: auth.userId,
      });

      await auditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        actorEmail: auth.email,
        action: "asset.reassigned",
        resourceType: "asset",
        resourceId: id,
        metadata: {
          previousOwner: asset.owner_email,
          newOwner,
          reason: body.reason,
        },
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

export const POST = handler;
export const PATCH = handler;
