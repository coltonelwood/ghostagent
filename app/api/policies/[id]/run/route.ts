import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireRole, AuthError } from "@/lib/org-auth";
import { auditLog } from "@/lib/audit";
import { evaluateAllPolicies } from "@/lib/policy-engine";

export const dynamic = "force-dynamic";

export const POST = withLogging(
  async (req: NextRequest, ctx: unknown) => {
    try {
      const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
      const auth = await requireRole("operator");
      const db = getAdminClient();

      const { data: policy } = await db
        .from("policies")
        .select("*")
        .eq("id", id)
        .eq("org_id", auth.orgId)
        .single();

      if (!policy) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
      const dryRun = body.dryRun ?? policy.dry_run_mode;

      const result = await evaluateAllPolicies(auth.orgId);

      // Update policy last_run
      await db
        .from("policies")
        .update({
          last_run_at: new Date().toISOString(),
          last_run_violations: result.violations.filter(
            (v) => (v as Record<string, unknown>).policy_id === id
          ).length,
        })
        .eq("id", id);

      const policyViolations = result.violations.filter(
        (v) => (v as Record<string, unknown>).policy_id === id
      );

      await auditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        actorEmail: auth.email,
        action: dryRun ? "policy.dry_run" : "policy.run",
        resourceType: "policy",
        resourceId: id,
        metadata: { violationsFound: policyViolations.length },
        req,
      });

      return NextResponse.json({
        data: {
          policyId: id,
          dryRun,
          violationsFound: policyViolations.length,
          violations: policyViolations.slice(0, 50),
          totalProcessed: result.processed,
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
