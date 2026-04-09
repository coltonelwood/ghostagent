import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import { getOrCreateOrgForUser, requireOrgMember } from "@/lib/org";
import { emitEvent } from "@/lib/event-system";
import { auditLog } from "@/lib/audit";
import { withLogging } from "@/lib/api-handler";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const POST = withLogging(async (req: NextRequest) => {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOrCreateOrgForUser(user.id, user.email!);
  await requireOrgMember(user.id, org.id, "admin");

  const db = getAdminClient();
  const body = await req.json() as { email: string; role: string };

  if (!body.email || !body.role) {
    return NextResponse.json({ error: "email and role are required" }, { status: 400 });
  }

  const validRoles = ["admin", "operator", "viewer"];
  if (!validRoles.includes(body.role)) {
    return NextResponse.json({ error: "Invalid role. Must be one of: admin, operator, viewer" }, { status: 400 });
  }

  // Check if already a member by email in org_members
  const { data: existingMembers } = await db
    .from("org_members")
    .select("id, user_id")
    .eq("org_id", org.id);

  // Check for pending invitation
  const { data: existingInvitation } = await db
    .from("invitations")
    .select("id")
    .eq("org_id", org.id)
    .eq("email", body.email)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (existingInvitation) {
    return NextResponse.json({ error: "An invitation has already been sent to this email" }, { status: 409 });
  }

  // Create invitation
  const { data: invitation, error } = await db
    .from("invitations")
    .insert({
      org_id: org.id,
      email: body.email,
      role: body.role,
      invited_by: user.id,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error }, "POST /api/org/invite error");
    return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
  }

  // Emit event
  await emitEvent({
    orgId: org.id,
    kind: "member_invited",
    severity: "info",
    title: `${body.email} invited to the organization`,
    actorId: user.id,
    metadata: { email: body.email, role: body.role },
  });

  // Audit log
  await auditLog({
    orgId: org.id,
    actorId: user.id,
    actorEmail: user.email,
    action: "member.invited",
    resourceType: "invitation",
    resourceId: invitation?.id,
    metadata: { email: body.email, role: body.role },
    req,
  });

  return NextResponse.json({ data: invitation }, { status: 201 });
});
