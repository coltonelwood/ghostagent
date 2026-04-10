import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { requireRole, AuthError } from "@/lib/org-auth";
import { adminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Params = { id: string };

/**
 * DELETE /api/org/invitations/[id]
 * Cancel a pending invitation. Requires admin role.
 */
export const DELETE = withLogging(async (req: NextRequest, ctx: unknown) => {
  try {
    const { id } = await (ctx as { params: Promise<Params> }).params;
    const auth = await requireRole("admin");

    // Verify invitation belongs to this org
    const { data: invite } = await adminClient
      .from("invitations")
      .select("id, org_id, email, accepted_at")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (!invite) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invite.accepted_at) {
      return NextResponse.json({ error: "This invitation has already been accepted and cannot be cancelled" }, { status: 409 });
    }

    await adminClient.from("invitations").delete().eq("id", id);

    await auditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      actorEmail: auth.email,
      action: "member.invitation_cancelled",
      resourceType: "invitation",
      resourceId: id,
      metadata: { email: invite.email },
      req,
    });

    logger.info({ orgId: auth.orgId, inviteId: id, email: invite.email }, "invitation cancelled");
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    logger.error({ err }, "DELETE /api/org/invitations/[id] error");
    return NextResponse.json({ error: "Failed to cancel invitation" }, { status: 500 });
  }
});
