import { NextRequest, NextResponse } from "next/server";
import { verifyInternalKey } from "@/lib/internal-auth";
import { identifyHotLeads } from "@/lib/growth-engine";
import { apiLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/growth/hot-leads
 *
 * Internal-only route that returns hot leads for sales outreach.
 * Protected by INTERNAL_API_KEY — not accessible to regular users.
 *
 * This is the ~5% human touch: review hot leads and do enterprise outreach.
 */
export async function GET(req: NextRequest) {
  if (!verifyInternalKey(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const leads = await identifyHotLeads();

    return NextResponse.json({
      leads,
      total: leads.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    apiLogger.error({ err }, "growth/hot-leads: unexpected error");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
