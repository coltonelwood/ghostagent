import { NextRequest, NextResponse } from "next/server";
import { syncAllDueConnectors, syncConnector } from "@/lib/sync-orchestrator";
import { verifyInternalKey, verifyCronSecret } from "@/lib/internal-auth";
import { logger } from "@/lib/logger";

export const maxDuration = 300;

/**
 * GET handler for Vercel Cron. Fails closed (403) when CRON_SECRET is
 * missing so a misconfigured deploy never exposes this endpoint
 * publicly. Env validation normally guarantees the secret is present,
 * but this is defense-in-depth.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
 * POST handler for internal service-to-service calls (triggered by
 * /api/connectors on creation, and by /api/connectors/[id]/sync).
 * Auth: INTERNAL_API_KEY via x-internal-key or Authorization: Bearer.
 */
export async function POST(req: NextRequest) {
  if (!verifyInternalKey(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { connectorId?: string; syncAll?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON" },
      { status: 400 },
    );
  }

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
