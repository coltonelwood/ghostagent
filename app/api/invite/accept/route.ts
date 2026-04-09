import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { adminClient } from "@/lib/supabase/admin";
import { emitEvent } from "@/lib/event-system";
import { logger } from "@/lib/logger";
import type { OrgRole } from "@/lib/types/platform";

export const dynamic = "force-dynamic";

/** POST /api/invite/accept — accept an invitation (requires auth) */
export async function POST(req: NextRequest) {
  // Require authentication
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in to accept an invitation" }, { status: 401 });

  const { token } = await req.json() as { token: string };
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  // Load the invitation
  const { data: invite, error: invErr } = await adminClient
    .from("invitations")
    .select("*")
    .eq("token", token)
    .single();

  if (invErr || !invite) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  if (invite.accepted_at) return NextResponse.json({ error: "Already accepted" }, { status: 410 });
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });

  // Enforce email match: the invitation was issued to a specific address.
  // A different user accepting it is a privilege escalation.
  // Allow case-insensitive match only.
  if (invite.email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    logger.warn({ inviteEmail: invite.email, userEmail: user.email }, "invite: email mismatch — rejected");
    return NextResponse.json(
      { error: "This invitation was sent to a different email address. Please sign in with the correct account." },
      { status: 403 }
    );
  }

  // Check if already a member
  const { data: existingMember } = await adminClient
    .from("org_members")
    .select("id")
    .eq("org_id", invite.org_id)
    .eq("user_id", user.id)
    .single();

  if (existingMember) {
    // Already a member — just mark accepted and redirect
    await adminClient.from("invitations").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
    return NextResponse.json({ success: true, message: "You are already a member of this organization" });
  }

  // Add user to org
  await adminClient.from("org_members").insert({
    org_id: invite.org_id,
    user_id: user.id,
    role: invite.role as OrgRole,
    invited_by: invite.invited_by,
    invited_at: invite.created_at,
    accepted_at: new Date().toISOString(),
  });

  // Mark invite as accepted
  await adminClient.from("invitations").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);

  // Emit event
  await emitEvent({
    orgId: invite.org_id,
    kind: "member_joined",
    severity: "info",
    title: (user.email ?? "A user") + " joined the organization",
    actorId: user.id,
    metadata: { role: invite.role, invited_email: invite.email },
  });

  logger.info({ orgId: invite.org_id, userId: user.id, role: invite.role }, "invite accepted");
  return NextResponse.json({ success: true });
}
