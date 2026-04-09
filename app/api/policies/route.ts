import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireRole, AuthError } from "@/lib/org-auth";
import { auditLog } from "@/lib/audit";
import { apiRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export const GET = withLogging(async (req: NextRequest) => {
  try {
    const auth = await requireAuth();

    const rl = apiRateLimiter.check(auth.userId);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
      );
    }

    const db = getAdminClient();
    const { data, error } = await db
      .from("policies")
      .select("*, policy_violations(count)")
      .eq("org_id", auth.orgId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});

export const POST = withLogging(async (req: NextRequest) => {
  try {
    const auth = await requireRole("admin");

    const rl = apiRateLimiter.check(auth.userId);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
      );
    }

    const body = (await req.json()) as {
      name: string;
      description?: string;
      severity?: string;
      conditions: unknown;
      scope?: unknown;
      actions?: unknown[];
      dry_run_mode?: boolean;
    };

    if (!body.name || !body.conditions) {
      return NextResponse.json(
        { error: "name and conditions are required" },
        { status: 400 },
      );
    }

    const db = getAdminClient();
    const { data: policy, error } = await db
      .from("policies")
      .insert({
        org_id: auth.orgId,
        name: body.name,
        description: body.description ?? null,
        severity: body.severity ?? "medium",
        conditions: body.conditions,
        scope: body.scope ?? {},
        actions: body.actions ?? [],
        dry_run_mode: body.dry_run_mode ?? false,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (error) throw error;

    await auditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      actorEmail: auth.email,
      action: "policy.created",
      resourceType: "policy",
      resourceId: policy.id,
      metadata: { name: body.name },
      req,
    });

    return NextResponse.json({ data: policy }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});
