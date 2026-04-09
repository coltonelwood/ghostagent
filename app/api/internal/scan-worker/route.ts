import { NextRequest, NextResponse } from "next/server";
import { runScan } from "@/lib/scanner";
import { syncConnector, scheduleOrgSyncs } from "@/lib/sync-orchestrator";
import { logger } from "@/lib/logger";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-internal-key");
  if (key !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    scanId?: string;
    workspaceId?: string;
    connectorId?: string;
    scheduleAll?: boolean;
  };

  // Legacy: GhostAgent repo scan
  if (body.scanId && body.workspaceId) {
    runScan(body.scanId, body.workspaceId).catch((err: unknown) =>
      logger.error({ err, scanId: body.scanId }, "scan-worker: scan failed")
    );
    return NextResponse.json({ started: true });
  }

  // Nexus: connector sync
  if (body.connectorId) {
    const result = await syncConnector(body.connectorId);
    return NextResponse.json(result);
  }

  // Schedule all due syncs
  if (body.scheduleAll) {
    const queued = await scheduleOrgSyncs();
    return NextResponse.json({ queued });
  }

  return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
}
