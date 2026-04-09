import { NextRequest, NextResponse } from "next/server";
import { scheduleOrgSyncs } from "@/lib/sync-orchestrator";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  // Vercel cron sends this header in production
  const cronSecret = req.headers.get("authorization");
  const internalKey = process.env.INTERNAL_API_KEY;
  if (internalKey && cronSecret === `Bearer ${internalKey}`) return true;
  // Allow Vercel's own cron invocation (loopback only in production)
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
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
