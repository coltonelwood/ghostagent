import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getOrCreateOrgForUser, requireOrgMember } from "@/lib/org";
import { executiveSummary } from "@/lib/compliance/report-generator";
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

  try {
    const report = await executiveSummary(org.id);
    return NextResponse.json({ data: report });
  } catch (err) {
    logger.error({ err }, "GET /api/compliance/report error");
    return NextResponse.json({ error: "Failed to generate compliance report" }, { status: 500 });
  }
});
