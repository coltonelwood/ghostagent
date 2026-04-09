import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { canRunScan } from "@/lib/stripe";
import { runScan } from "@/lib/scanner";
import { apiLogger } from "@/lib/logger";
import { scanRateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 5 scans per hour per user
  if (!scanRateLimiter.check(user.id)) {
    apiLogger.warn({ userId: user.id }, "scan rate limit exceeded");
    return NextResponse.json(
      { error: "Too many scan requests. Limit is 5 scans per hour." },
      { status: 429, headers: { "Retry-After": "3600" } }
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
  const { data: scan, error: scanError } = await adminClient
    .from("scans")
    .insert({ workspace_id, status: "pending" })
    .select()
    .single();

  if (scanError || !scan) {
    apiLogger.error({ workspaceId: workspace_id, error: scanError }, "failed to create scan record");
    return NextResponse.json({ error: "Failed to create scan" }, { status: 500 });
  }

  apiLogger.info({ scanId: scan.id, workspaceId: workspace_id, userId: user.id }, "scan started");

  // Fire and forget — scan runs in background
  runScan(scan.id, workspace_id).catch((err) => {
    apiLogger.error({ scanId: scan.id, error: err?.message }, "scan threw unhandled error");
  });

  return NextResponse.json({ scan });
}
