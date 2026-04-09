import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import { getOrCreateOrgForUser, requireOrgMember } from "@/lib/org";
import { withLogging } from "@/lib/api-handler";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const GET = withLogging(async () => {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOrCreateOrgForUser(user.id, user.email!);
  await requireOrgMember(user.id, org.id, "viewer");

  const db = getAdminClient();

  const [membersRes, invitationsRes] = await Promise.all([
    db.from("org_members")
      .select("*")
      .eq("org_id", org.id)
      .order("created_at", { ascending: true }),
    db.from("invitations")
      .select("*")
      .eq("org_id", org.id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString()),
  ]);

  if (membersRes.error) {
    logger.error({ error: membersRes.error }, "GET /api/org/members error");
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      members: membersRes.data ?? [],
      invitations: invitationsRes.data ?? [],
    },
  });
});
