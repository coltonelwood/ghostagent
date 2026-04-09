import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  let { data: workspace } = await supabase
    .from("workspaces")
    .select("id, owner_id, name, github_org, stripe_customer_id, stripe_sub_id, plan, scan_count, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  // Auto-create workspace for first-time users (fallback if callback didn't run)
  if (!workspace) {
    const { data: newWs } = await adminClient
      .from("workspaces")
      .insert({
        owner_id: user.id,
        name: user.email?.split("@")[0] ?? "My Workspace",
      })
      .select("id, owner_id, name, github_org, stripe_customer_id, stripe_sub_id, plan, scan_count, created_at")
      .single();
    workspace = newWs;
  }

  if (!workspace) redirect("/auth/login");

  return (
    <DashboardShell user={user} workspace={workspace}>
      {children}
    </DashboardShell>
  );
}
