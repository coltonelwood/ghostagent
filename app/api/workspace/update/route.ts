import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: unknown; github_org?: unknown; github_token?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Whitelist allowed fields — never allow updating owner_id, plan, stripe_*, scan_count directly
  const updates: Record<string, string> = {};

  if (body.name && typeof body.name === "string") {
    const trimmed = body.name.trim().slice(0, 100);
    if (trimmed) updates.name = trimmed;
  }

  if (body.github_org && typeof body.github_org === "string") {
    // Sanitize org name — only alphanumeric, hyphens, dots
    const org = body.github_org.trim().replace(/[^a-zA-Z0-9\-_.]/g, "").slice(0, 100);
    if (org) updates.github_org = org;
  }

  if (body.github_token && typeof body.github_token === "string") {
    const token = body.github_token.trim();
    // Basic token format validation
    if (token.length < 10) {
      return NextResponse.json({ error: "Invalid GitHub token" }, { status: 400 });
    }
    updates.github_token = token;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Use adminClient to bypass RLS for the update, but verify ownership first
  const { data: existing } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const { error } = await adminClient
    .from("workspaces")
    .update(updates)
    .eq("owner_id", user.id);

  if (error) {
    console.error("[workspace/update]", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
