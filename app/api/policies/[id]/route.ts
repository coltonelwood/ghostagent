import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireRole, AuthError } from "@/lib/org-auth";
import { auditLog } from "@/lib/audit";
import { apiRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

async function loadPolicy(id: string, orgId: string) {
  const db = getAdminClient();
  const { data } = await db
    .from("policies")
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

      const policy = await loadPolicy(id, auth.orgId);
      if (!policy) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      // Get violation summary
      const db = getAdminClient();
      const [openRes, resolvedRes, totalRes] = await Promise.all([
        db
          .from("policy_violations")
          .select("id", { count: "exact", head: true })
          .eq("policy_id", id)
          .eq("org_id", auth.orgId)
          .in("status", ["open", "acknowledged"]),
        db
          .from("policy_violations")
          .select("id", { count: "exact", head: true })
          .eq("policy_id", id)
          .eq("org_id", auth.orgId)
          .eq("status", "resolved"),
        db
          .from("policy_violations")
          .select("id", { count: "exact", head: true })
          .eq("policy_id", id)
          .eq("org_id", auth.orgId),
      ]);

      return NextResponse.json({
        data: {
          ...policy,
          violationSummary: {
            open: openRes.count ?? 0,
            resolved: resolvedRes.count ?? 0,
            total: totalRes.count ?? 0,
          },
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
      const auth = await requireRole("admin");

      const policy = await loadPolicy(id, auth.orgId);
      if (!policy) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const body = (await req.json()) as {
        name?: string;
        description?: string;
        severity?: string;
        conditions?: unknown;
        scope?: unknown;
        actions?: unknown[];
        enabled?: boolean;
        dry_run_mode?: boolean;
      };

      const updates: Record<string, unknown> = {};
      const allowedFields = [
        "name",
        "description",
        "severity",
        "conditions",
        "scope",
        "actions",
        "enabled",
        "dry_run_mode",
      ];
      for (const field of allowedFields) {
        if (body[field as keyof typeof body] !== undefined) {
          updates[field] = body[field as keyof typeof body];
        }
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { error: "No valid fields to update" },
          { status: 400 },
        );
      }

      updates.updated_at = new Date().toISOString();

      const db = getAdminClient();
      const { data: updated, error } = await db
        .from("policies")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      await auditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        actorEmail: auth.email,
        action: "policy.updated",
        resourceType: "policy",
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

export const DELETE = withLogging(
  async (req: NextRequest, ctx: unknown) => {
    try {
      const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
      const auth = await requireRole("admin");

      const policy = await loadPolicy(id, auth.orgId);
      if (!policy) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const db = getAdminClient();
      const { error } = await db.from("policies").delete().eq("id", id);

      if (error) throw error;

      await auditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        actorEmail: auth.email,
        action: "policy.deleted",
        resourceType: "policy",
        resourceId: id,
        metadata: { name: policy.name },
        req,
      });

      return NextResponse.json({ success: true });
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  },
);
