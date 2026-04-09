import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** GET /api/invite?token=xxx — fetch invite details (public, no auth needed) */
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const { data: invite, error } = await adminClient
    .from("invitations")
    .select("id, email, role, expires_at, accepted_at, org_id, organizations(name)")
    .eq("token", token)
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  if (invite.accepted_at) {
    return NextResponse.json({ error: "This invitation has already been accepted" }, { status: 410 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invitation has expired. Ask an admin to send a new one." }, { status: 410 });
  }

  const org = invite.organizations as unknown as { name: string } | null;

  return NextResponse.json({
    data: {
      email: invite.email,
      role: invite.role,
      org_name: org?.name ?? "Unknown Organization",
      expires_at: invite.expires_at,
    },
  });
}
