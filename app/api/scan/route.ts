import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { canRunScan } from "@/lib/stripe";
import { apiLogger } from "@/lib/logger";
import { scanRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";

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
  const rateCheck = scanRateLimiter.check(user.id);
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

  // Delegate to dedicated long-running worker endpoint (maxDuration: 300s in vercel.json)
  // This is more reliable than fire-and-forget in the current function context
  const workerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/internal/scan-worker`;
  fetch(workerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": process.env.INTERNAL_API_KEY ?? "",
    },
    body: JSON.stringify({ scanId: scan.id, workspaceId: workspace_id }),
  }).catch((err) => {
    apiLogger.error({ scanId: scan.id, error: err?.message }, "failed to dispatch scan worker");
  });

  return NextResponse.json({ scan });
}
