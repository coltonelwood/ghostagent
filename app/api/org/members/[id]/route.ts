import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import { getOrCreateOrgForUser, requireOrgMember } from "@/lib/org";
import { auditLog } from "@/lib/audit";
import { emitEvent } from "@/lib/event-system";
import { withLogging } from "@/lib/api-handler";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export const PATCH = withLogging(async (
  req: NextRequest,
  ctx: unknown,
) => {
  const { id: memberId } = await (ctx as { params: Promise<{ id: string }> }).params;

  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOrCreateOrgForUser(user.id, user.email!);
  await requireOrgMember(user.id, org.id, "admin");

  const db = getAdminClient();
  const body = await req.json() as { role: string };

  if (!body.role) {
    return NextResponse.json({ error: "role is required" }, { status: 400 });
  }

  const validRoles = ["owner", "admin", "operator", "viewer"];
  if (!validRoles.includes(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Load the target member
  const { data: targetMember } = await db
    .from("org_members")
    .select("*")
    .eq("id", memberId)
    .eq("org_id", org.id)
    .single();

  if (!targetMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Prevent removing the last owner
  if (targetMember.role === "owner" && body.role !== "owner") {
    const { count } = await db
      .from("org_members")
      .select("*", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("role", "owner");

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Cannot change the role of the last owner. Assign another owner first." },
        { status: 400 },
      );
    }
  }

  const { data: updated, error } = await db
    .from("org_members")
    .update({ role: body.role, updated_at: new Date().toISOString() })
    .eq("id", memberId)
    .select()
    .single();

  if (error) {
    logger.error({ error }, "PATCH /api/org/members/[id] error");
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 });
  }

  await auditLog({
    orgId: org.id,
    actorId: user.id,
    actorEmail: user.email,
    action: "member.role_changed",
    resourceType: "org_member",
    resourceId: memberId,
    metadata: { previousRole: targetMember.role, newRole: body.role, targetUserId: targetMember.user_id },
    req,
  });

  return NextResponse.json({ data: updated });
});

export const DELETE = withLogging(async (
  req: NextRequest,
  ctx: unknown,
) => {
  const { id: memberId } = await (ctx as { params: Promise<{ id: string }> }).params;

  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOrCreateOrgForUser(user.id, user.email!);
  await requireOrgMember(user.id, org.id, "admin");

  const db = getAdminClient();

  // Load the target member
  const { data: targetMember } = await db
    .from("org_members")
    .select("*")
    .eq("id", memberId)
    .eq("org_id", org.id)
    .single();

  if (!targetMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Prevent removing the last owner
  if (targetMember.role === "owner") {
    const { count } = await db
      .from("org_members")
      .select("*", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("role", "owner");

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the last owner of the organization." },
        { status: 400 },
      );
    }
  }

  const { error } = await db
    .from("org_members")
    .delete()
    .eq("id", memberId)
    .eq("org_id", org.id);

  if (error) {
    logger.error({ error }, "DELETE /api/org/members/[id] error");
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }

  await emitEvent({
    orgId: org.id,
    kind: "member_removed",
    severity: "info",
    title: `Member removed from organization`,
    actorId: user.id,
    metadata: { removedUserId: targetMember.user_id, role: targetMember.role },
  });

  await auditLog({
    orgId: org.id,
    actorId: user.id,
    actorEmail: user.email,
    action: "member.removed",
    resourceType: "org_member",
    resourceId: memberId,
    metadata: { removedUserId: targetMember.user_id, role: targetMember.role },
    req,
  });

  return NextResponse.json({ success: true });
});
