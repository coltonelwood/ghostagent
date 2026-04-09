import { NextRequest, NextResponse } from "next/server";
import { syncAllDueConnectors, syncConnector } from "@/lib/sync-orchestrator";
import { logger } from "@/lib/logger";

export const maxDuration = 300;

/**
 * GET handler for Vercel Cron.
 * Vercel cron jobs call GET — no auth needed (Vercel handles it).
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  try {
    logger.info("sync-worker: cron triggered — syncing all due connectors");
    await syncAllDueConnectors();
    return NextResponse.json({ ok: true, action: "sync_all_due" });
  } catch (err) {
    logger.error({ err }, "sync-worker: cron sync failed");
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

/**
 * POST handler for internal API calls.
 * Auth: INTERNAL_API_KEY header.
 * Body: { connectorId?: string; syncAll?: boolean }
 */
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-internal-key");
  if (key !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    connectorId?: string;
    syncAll?: boolean;
  };

  // Sync a specific connector
  if (body.connectorId) {
    try {
      logger.info({ connectorId: body.connectorId }, "sync-worker: syncing connector");
      await syncConnector(body.connectorId);
      return NextResponse.json({ ok: true, action: "sync_connector", connectorId: body.connectorId });
    } catch (err) {
      logger.error({ err, connectorId: body.connectorId }, "sync-worker: connector sync failed");
      return NextResponse.json({ error: "Connector sync failed" }, { status: 500 });
    }
  }

  // Sync all due connectors
  if (body.syncAll) {
    try {
      logger.info("sync-worker: syncing all due connectors");
      await syncAllDueConnectors();
      return NextResponse.json({ ok: true, action: "sync_all_due" });
    } catch (err) {
      logger.error({ err }, "sync-worker: sync all failed");
      return NextResponse.json({ error: "Sync all failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Provide connectorId or syncAll" }, { status: 400 });
}
