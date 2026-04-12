import { NextRequest, NextResponse } from "next/server";
import { scheduleOrgSyncs } from "@/lib/sync-orchestrator";
import { verifyCronSecret } from "@/lib/internal-auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel cron endpoint — schedules connector syncs for any org whose
 * last sync is stale. Authorized via CRON_SECRET (Vercel sends it as
 * `Authorization: Bearer <CRON_SECRET>`). Fails closed on missing
 * secret so a misconfigured deploy never exposes this publicly.
 *
 * Previously used INTERNAL_API_KEY here, which was inconsistent with
 * the other cron routes and would silently stop working if an
 * operator rotated INTERNAL_API_KEY without also updating the cron
 * invocation.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const queued = await scheduleOrgSyncs();
    logger.info({ queued }, "sync-schedule: queued connector syncs");
    return NextResponse.json({ queued });
  } catch (err) {
    logger.error({ err }, "sync-schedule: error");
    return NextResponse.json({ error: "Sync scheduling failed" }, { status: 500 });
  }
}
