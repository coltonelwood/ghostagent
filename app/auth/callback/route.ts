import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const redirectTo = new URL("/dashboard", req.url);

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Check if user has a workspace, create one if not
      const { data: workspaces } = await adminClient
        .from("workspaces")
        .select("id")
        .eq("owner_id", data.user.id);

      if (!workspaces || workspaces.length === 0) {
        await adminClient.from("workspaces").insert({
          owner_id: data.user.id,
          name: data.user.email?.split("@")[0] ?? "My Workspace",
        });
      }
    }
  }

  return NextResponse.redirect(redirectTo);
}
