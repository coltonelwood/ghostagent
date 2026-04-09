import { NextResponse } from "next/server";
import { scheduleOrgSyncs } from "@/lib/sync-orchestrator";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const queued = await scheduleOrgSyncs();
    logger.info({ queued }, "sync-schedule: queued connector syncs");
    return NextResponse.json({ queued });
  } catch (err) {
    logger.error({ err }, "sync-schedule: error");
    return NextResponse.json({ error: "Sync scheduling failed" }, { status: 500 });
  }
}
