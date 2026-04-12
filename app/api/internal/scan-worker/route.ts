import { NextRequest, NextResponse } from "next/server";
import { runScan } from "@/lib/scanner";
import { syncConnector, scheduleOrgSyncs } from "@/lib/sync-orchestrator";
import { verifyInternalKey } from "@/lib/internal-auth";
import { logger } from "@/lib/logger";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!verifyInternalKey(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    scanId?: string;
    workspaceId?: string;
    connectorId?: string;
    scheduleAll?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON" },
      { status: 400 },
    );
  }

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
