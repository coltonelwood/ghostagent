import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { verifyInternalKey, verifyCronSecret } from "@/lib/internal-auth";
import { apiLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Internal cleanup job — marks stuck scans as failed. Called either by
 * Vercel cron (GET with CRON_SECRET) or by an internal service
 * (POST with INTERNAL_API_KEY). Both paths fail closed on missing
 * secrets.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return handleCleanup();
}

export async function POST(req: NextRequest) {
  if (!verifyInternalKey(req)) {
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
