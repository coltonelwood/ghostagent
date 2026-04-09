import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login?error=no_code", req.url));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(new URL("/auth/login?error=exchange_failed", req.url));
  }

  const user = data.user;
  const email = user.email ?? "";

  // --- Legacy: ensure GhostAgent workspace exists ---
  const { data: workspaces } = await adminClient
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1);

  if (!workspaces || workspaces.length === 0) {
    await adminClient.from("workspaces").insert({
      owner_id: user.id,
      name: email.split("@")[0] ?? "My Workspace",
    });
  }

  // --- Nexus: ensure org exists ---
  const { data: membership } = await adminClient
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  let isNewUser = false;

  if (!membership) {
    // Brand new user — create their first organization
    const slug =
      (email.split("@")[0] ?? "user")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 20) +
      "-" +
      Math.random().toString(36).slice(2, 6);

    const { data: org } = await adminClient
      .from("organizations")
      .insert({
        name: (email.split("@")[0] ?? "My Organization") + "'s Organization",
        slug,
        plan: "starter",
      })
      .select("id")
      .single();

    if (org) {
      await adminClient.from("org_members").insert({
        org_id: org.id,
        user_id: user.id,
        role: "owner",
        accepted_at: new Date().toISOString(),
      });
      isNewUser = true;
    }
  }

  // Route: new users go to onboarding, returning users to platform
  const redirectTo = next
    ? new URL(next, req.url)
    : isNewUser
    ? new URL("/onboarding", req.url)
    : new URL("/platform", req.url);

  return NextResponse.redirect(redirectTo);
}
