import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ScanButton } from "@/components/dashboard/scan-button";
import { ScansList } from "@/components/dashboard/scans-list";
import { StatsCards } from "@/components/dashboard/stats-cards";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (!workspace) redirect("/auth/login");

  const { data: scans } = await supabase
    .from("scans")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("started_at", { ascending: false })
    .limit(10);

  const { data: agents } = await supabase
    .from("agents")
    .select("*")
    .eq("workspace_id", workspace.id);

  const criticalCount = agents?.filter((a) => a.risk_level === "critical").length ?? 0;
  const highCount = agents?.filter((a) => a.risk_level === "high").length ?? 0;
  const totalAgents = agents?.length ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {workspace.github_org
              ? `Monitoring ${workspace.github_org}`
              : "Connect your GitHub org to start scanning"}
          </p>
        </div>
        <ScanButton
          workspaceId={workspace.id}
          hasGithub={!!workspace.github_org}
          plan={workspace.plan}
          scanCount={workspace.scan_count}
        />
      </div>

      <StatsCards
        totalAgents={totalAgents}
        criticalCount={criticalCount}
        highCount={highCount}
        totalScans={scans?.length ?? 0}
      />

      <ScansList scans={scans ?? []} />
    </div>
  );
}
