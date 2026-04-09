import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { requireRole, AuthError } from "@/lib/org-auth";
import { adminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Params = { id: string; violationId: string };

/**
 * PATCH /api/policies/[id]/violations/[violationId]
 * Update violation status (acknowledge, resolve, suppress)
 */
export const PATCH = withLogging(async (req: NextRequest, ctx: unknown) => {
  try {
    const { id: policyId, violationId } = await (ctx as { params: Promise<Params> }).params;
    const auth = await requireRole("operator");

    const body = await req.json() as { status: string; notes?: string };
    const validStatuses = ["open", "acknowledged", "resolved", "suppressed"];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status. Must be one of: " + validStatuses.join(", ") }, { status: 400 });
    }

    // Verify violation belongs to this org's policy
    const { data: violation } = await adminClient
      .from("policy_violations")
      .select("id, org_id, policy_id, status")
      .eq("id", violationId)
      .eq("policy_id", policyId)
      .eq("org_id", auth.orgId)
      .single();

    if (!violation) {
      return NextResponse.json({ error: "Violation not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {
      status: body.status,
      updated_at: new Date().toISOString(),
    };

    if (body.status === "resolved") {
      updates.resolved_at = new Date().toISOString();
      updates.resolved_by = auth.userId;
    }
    if (body.notes) updates.notes = body.notes;

    const { data: updated, error } = await adminClient
      .from("policy_violations")
      .update(updates)
      .eq("id", violationId)
      .select()
      .single();

    if (error) throw error;

    await auditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      actorEmail: auth.email,
      action: "policy_violation.status_updated",
      resourceType: "policy_violation",
      resourceId: violationId,
      metadata: { policy_id: policyId, old_status: violation.status, new_status: body.status },
      req,
    });

    logger.info({ policyId, violationId, status: body.status, orgId: auth.orgId }, "violation status updated");
    return NextResponse.json({ data: updated });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    logger.error({ err }, "PATCH /api/policies/[id]/violations/[violationId] error");
    return NextResponse.json({ error: "Failed to update violation" }, { status: 500 });
  }
});
