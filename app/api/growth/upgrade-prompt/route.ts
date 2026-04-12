import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUpgradePrompt } from "@/lib/growth-engine";
import { apiLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/growth/upgrade-prompt
 *
 * Returns contextual upgrade prompt data for the current org.
 * Used by the frontend to display smart upgrade nudges.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const prompt = await getUpgradePrompt(membership.org_id);
    return NextResponse.json(prompt);
  } catch (err) {
    apiLogger.error({ err }, "growth/upgrade-prompt: unexpected error");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
