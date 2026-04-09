import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { requireAuth, AuthError } from "@/lib/org-auth";
import { adminClient } from "@/lib/supabase/admin";
import { evaluatePolicy } from "@/lib/policy-engine";
import { logger } from "@/lib/logger";
import type { Asset, Policy, PolicyConditionGroup, PolicyScope } from "@/lib/types/platform";

export const dynamic = "force-dynamic";

/**
 * POST /api/policies/preview
 * Dry-run a policy condition against all org assets without persisting anything.
 * Returns matching assets for the preview UI.
 */
export const POST = withLogging(async (req: NextRequest) => {
  try {
    const auth = await requireAuth();

    const body = await req.json() as {
      conditions: PolicyConditionGroup;
      scope?: PolicyScope;
    };

    if (!body.conditions) {
      return NextResponse.json({ error: "conditions is required" }, { status: 400 });
    }

    const { data: assets } = await adminClient
      .from("assets")
      .select("id, name, source, risk_level, risk_score, owner_status, environment, status")
      .eq("org_id", auth.orgId)
      .eq("status", "active")
      .limit(500);

    if (!assets?.length) {
      return NextResponse.json({ data: [], total: 0 });
    }

    // Build a temporary policy for evaluation
    const tempPolicy: Policy = {
      id: "preview",
      org_id: auth.orgId,
      name: "Preview",
      description: null,
      enabled: true,
      severity: "info",
      conditions: body.conditions,
      scope: body.scope ?? {},
      actions: [],
      created_by: auth.userId,
      last_run_at: null,
      last_run_violations: 0,
      dry_run_mode: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const matching = assets
      .filter(a => evaluatePolicy(tempPolicy, a as unknown as Asset))
      .map(a => ({
        id: a.id,
        name: a.name,
        source: a.source,
        risk_level: a.risk_level,
        risk_score: a.risk_score,
        owner_status: a.owner_status,
        environment: a.environment,
      }));

    return NextResponse.json({
      data: matching.slice(0, 20), // return first 20 for preview
      total: matching.length,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logger.error({ err }, "POST /api/policies/preview error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
