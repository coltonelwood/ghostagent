import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { canRunScan } from "@/lib/stripe";
import { apiLogger } from "@/lib/logger";
import { scanRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Best-effort dispatch of the background scan worker. We want the user's
 * request to return immediately (creating the scan row), but we must not
 * leave the scan stuck in "pending" if the worker fetch fails to even
 * start. `after()` keeps the function alive on Vercel until this promise
 * resolves, and if dispatch fails after retries we mark the scan failed
 * so the UI surfaces a clear error instead of hanging forever.
 */
async function dispatchScanWorker(
  scanId: string,
  workspaceId: string,
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!baseUrl || !internalKey) {
    apiLogger.error(
      { scanId },
      "scan worker dispatch skipped — NEXT_PUBLIC_APP_URL or INTERNAL_API_KEY not set",
    );
    await markScanFailed(scanId, "Server not configured — contact support.");
    return;
  }

  const workerUrl = `${baseUrl.replace(/\/$/, "")}/api/internal/scan-worker`;
  const body = JSON.stringify({ scanId, workspaceId });

  // 3 attempts with exponential backoff: 0s, 1s, 3s
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, attempt * 1000 + 1000));
    }
    try {
      const res = await fetch(workerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-key": internalKey,
        },
        body,
        // Short connect timeout so a hung TCP handshake doesn't eat the
        // whole request.
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return;
      // Worker rejected — record the reason and don't retry on auth.
      if (res.status === 401 || res.status === 403) {
        lastError = `worker rejected dispatch: ${res.status}`;
        break;
      }
      lastError = `worker returned ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  apiLogger.error(
    { scanId, lastError },
    "failed to dispatch scan worker after retries",
  );
  await markScanFailed(
    scanId,
    "Couldn't start the scan worker. Please try again in a minute.",
  );
}

async function markScanFailed(scanId: string, message: string): Promise<void> {
  try {
    await adminClient
      .from("scans")
      .update({
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", scanId)
      .in("status", ["pending", "scanning", "classifying"]);
  } catch (err) {
    apiLogger.error(
      { scanId, err },
      "failed to mark scan as failed — scan may be stuck in pending",
    );
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 5 scans per hour per user. Uses Upstash when configured
  // so the limit holds across all Vercel instances; falls back to the
  // in-memory sliding window if Redis is unreachable.
  const rateCheck = await scanRateLimiter.checkAsync(user.id);
  if (!rateCheck.allowed) {
    apiLogger.warn({ userId: user.id }, "scan rate limit exceeded");
    return NextResponse.json(
      { error: "Too many scan requests. Limit is 5 scans per hour." },
      { status: 429, headers: rateLimitHeaders(0, rateCheck.resetAt) }
    );
  }

  let body: { workspace_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { workspace_id } = body;
  if (!workspace_id || typeof workspace_id !== "string") {
    return NextResponse.json({ error: "workspace_id is required" }, { status: 400 });
  }

  // Ownership check via user-scoped client
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, plan, scan_count, github_org")
    .eq("id", workspace_id)
    .eq("owner_id", user.id)
    .single();

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  if (!workspace.github_org) {
    return NextResponse.json(
      { error: "GitHub not configured. Add your org and token in Settings." },
      { status: 400 }
    );
  }

  if (!canRunScan(workspace.plan, workspace.scan_count)) {
    return NextResponse.json(
      { error: "Upgrade to Pro to run more scans." },
      { status: 403 }
    );
  }

  // Check if a scan is already running for this workspace
  const { data: running } = await adminClient
    .from("scans")
    .select("id")
    .eq("workspace_id", workspace_id)
    .in("status", ["pending", "scanning", "classifying"])
    .limit(1)
    .maybeSingle();

  if (running) {
    return NextResponse.json(
      { error: "A scan is already in progress for this workspace.", scan: running },
      { status: 409 }
    );
  }

  // Create scan record
  // If the DB unique index fires (concurrent insert), it returns a 23505 unique violation
  const { data: scan, error: scanError } = await adminClient
    .from("scans")
    .insert({ workspace_id, status: "pending" })
    .select()
    .single();

  if (scanError) {
    // Postgres unique violation: another scan just started concurrently
    if (scanError.code === "23505") {
      return NextResponse.json(
        { error: "A scan is already in progress for this workspace." },
        { status: 409 }
      );
    }
    apiLogger.error({ workspaceId: workspace_id, error: scanError }, "failed to create scan record");
    return NextResponse.json({ error: "Failed to create scan" }, { status: 500 });
  }

  if (!scan) {
    return NextResponse.json({ error: "Failed to create scan" }, { status: 500 });
  }

  apiLogger.info({ scanId: scan.id, workspaceId: workspace_id, userId: user.id }, "scan started");

  // Dispatch the worker in the background. `after()` keeps the Vercel
  // function alive until the promise resolves but lets the user response
  // go out immediately. If dispatch fails, markScanFailed() unsticks the
  // scan so the UI can show a clear error rather than hanging at "pending".
  after(dispatchScanWorker(scan.id, workspace_id));

  return NextResponse.json({ scan });
}
