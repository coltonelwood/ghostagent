import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { BillingCard } from "@/components/dashboard/billing-card";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, owner_id, name, github_org, stripe_customer_id, stripe_sub_id, plan, scan_count, created_at, github_token")
    .eq("owner_id", user.id)
    .single();

  if (!workspace) redirect("/auth/login");

  // Never pass the raw token to the client — only pass whether it's set
  const safeWorkspace = {
    ...workspace,
    github_token: workspace.github_token ? "[set]" : null,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Configure your GitHub connection and billing
        </p>
      </div>

      <SettingsForm workspace={safeWorkspace} />
      <BillingCard workspace={safeWorkspace} />
    </div>
  );
}
