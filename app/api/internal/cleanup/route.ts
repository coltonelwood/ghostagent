import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { apiLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Internal cleanup job — marks stuck scans as failed.
 * Called by Vercel cron (vercel.json) or external uptime monitor.
 * Protected by INTERNAL_API_KEY.
 */
// Vercel cron calls GET with no auth (runs in Vercel's trusted infra)
// External callers must use POST with x-internal-key
export async function GET(req: NextRequest) {
  // Verify Vercel cron secret if configured (Vercel Pro sends Authorization: Bearer <CRON_SECRET>)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  return handleCleanup();
}

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-internal-key") ||
    req.headers.get("authorization")?.replace("Bearer ", "");
  const validKey = process.env.INTERNAL_API_KEY;
  if (!key || key !== validKey) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return handleCleanup();
}

async function handleCleanup() {

  // Mark scans stuck >10 minutes as failed
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: stuck, error } = await adminClient
    .from("scans")
    .update({
      status: "failed",
      error_message: "Scan timed out — please try again",
    })
    .in("status", ["pending", "scanning", "classifying"])
    .lt("started_at", tenMinutesAgo)
    .select("id");

  if (error) {
    apiLogger.error({ error }, "cleanup: failed to update stuck scans");
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }

  const count = stuck?.length ?? 0;
  if (count > 0) {
    apiLogger.warn({ count, scanIds: stuck?.map((s) => s.id) }, "cleanup: marked stuck scans as failed");
  } else {
    apiLogger.info("cleanup: no stuck scans found");
  }

  return NextResponse.json({ cleaned: count });
}
