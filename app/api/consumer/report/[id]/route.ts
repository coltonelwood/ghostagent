import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, AuthError } from "@/lib/org-auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { withLogging } from "@/lib/api-handler";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const GET = withLogging(async (
  req: NextRequest,
  ctx: unknown,
) => {
  try {
    const { id } = await (ctx as { params: Promise<{ id: string }> }).params;

    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminClient();
    const { data: report, error } = await db
      .from("threat_reports")
      .select("*, ai_analysis")
      .eq("id", id)
      .eq("reporter_id", user.id)
      .single();

    if (error || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json({ data: report });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});
