import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { trackOnboardingEvent } from "@/lib/growth-engine";
import { apiLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/growth/onboarding-event
 *
 * Records an onboarding funnel event and updates lead score.
 * Called from the frontend during onboarding flow.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { event, metadata = {} } = await req.json();

    if (!event || typeof event !== "string") {
      return NextResponse.json({ error: "event is required" }, { status: 400 });
    }

    // Get user's org
    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    await trackOnboardingEvent(membership.org_id, user.id, event, metadata);

    return NextResponse.json({ ok: true });
  } catch (err) {
    apiLogger.error({ err }, "growth/onboarding-event: unexpected error");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
