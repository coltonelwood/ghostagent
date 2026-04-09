import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { canRunScan } from "@/lib/stripe";
import { runScan } from "@/lib/scanner";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspace_id } = await req.json();

  // Get workspace
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspace_id)
    .single();

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  if (!workspace.github_org || !workspace.github_token) {
    return NextResponse.json(
      { error: "GitHub not configured. Add your org and token in settings." },
      { status: 400 }
    );
  }

  // Check plan limits
  if (!canRunScan(workspace.plan, workspace.scan_count)) {
    return NextResponse.json(
      { error: "Upgrade to Pro to run more scans." },
      { status: 403 }
    );
  }

  // Create scan record
  const { data: scan, error } = await adminClient
    .from("scans")
    .insert({ workspace_id, status: "pending" })
    .select()
    .single();

  if (error || !scan) {
    return NextResponse.json(
      { error: "Failed to create scan" },
      { status: 500 }
    );
  }

  // Fire and forget — scan runs in background
  runScan(scan.id, workspace_id).catch(console.error);

  return NextResponse.json({ scan });
}
