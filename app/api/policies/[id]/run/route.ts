import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { requireRole, AuthError } from "@/lib/org-auth";
import { runPolicy, dryRunPolicy } from "@/lib/policy-engine";
import { adminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import type { Policy } from "@/lib/types/platform";

export const dynamic = "force-dynamic";

export const POST = withLogging(async (req: NextRequest, ctx: unknown) => {
  try {
    const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
    const auth = await requireRole("operator");

    const body = await req.json().catch(() => ({})) as { dry_run?: boolean };
    const isDryRun = body.dry_run === true;

    // Verify policy belongs to this org
    const { data: policy } = await adminClient
      .from("policies")
      .select("*")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (!policy) return NextResponse.json({ error: "Policy not found" }, { status: 404 });

    if (isDryRun) {
      const result = await dryRunPolicy(policy as unknown as Policy, auth.orgId);
      return NextResponse.json({
        data: {
          dry_run: true,
          matching_asset_count: result.matchCount,
          matching_asset_ids: result.matchingAssetIds,
        },
      });
    }

    const result = await runPolicy(id, auth.orgId, false);

    logger.info({ policyId: id, orgId: auth.orgId, violations: result.total }, "policy run");

    return NextResponse.json({
      data: {
        dry_run: false,
        violations_found: result.total,
        violations: result.violations.slice(0, 50), // cap response size
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logger.error({ err }, "POST /api/policies/[id]/run error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
