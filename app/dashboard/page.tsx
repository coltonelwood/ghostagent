import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ScanButton } from "@/components/dashboard/scan-button";
import { ScansList } from "@/components/dashboard/scans-list";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { Settings, ArrowRight } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, owner_id, name, github_org, stripe_customer_id, stripe_sub_id, plan, scan_count, created_at")
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
    .select("id, risk_level")
    .eq("workspace_id", workspace.id)
    .order("risk_level", { ascending: true })
    .limit(100);

  const criticalCount = agents?.filter((a) => a.risk_level === "critical").length ?? 0;
  const highCount = agents?.filter((a) => a.risk_level === "high").length ?? 0;
  const totalAgents = agents?.length ?? 0;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GitHub Scanner</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {workspace.github_org
              ? `Scanning ${workspace.github_org}`
              : "Connect a GitHub organization to start scanning"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border rounded-lg px-3 py-2 hover:bg-accent transition-all"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </Link>
          <ScanButton
            workspaceId={workspace.id}
            hasGithub={!!workspace.github_org}
            plan={workspace.plan}
            scanCount={workspace.scan_count}
          />
        </div>
      </div>

      {/* GitHub not configured — onboarding callout */}
      {!workspace.github_org && (
        <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-8 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-2xl">🐙</div>
          <div>
            <h3 className="font-semibold text-base">Connect your GitHub organization</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Add your GitHub org and a personal access token to start discovering AI assets across your repositories.
            </p>
          </div>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
          >
            Connect GitHub <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* Stats */}
      {totalAgents > 0 && (
        <StatsCards
          totalAgents={totalAgents}
          criticalCount={criticalCount}
          highCount={highCount}
          totalScans={scans?.length ?? 0}
        />
      )}

      {/* Scans list */}
      <ScansList scans={scans ?? []} />

      {/* Platform upgrade callout */}
      <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-violet-900">Looking for the full platform?</p>
          <p className="text-xs text-violet-700 mt-0.5">
            Policy enforcement, compliance reports, multi-source connectors, and more.
          </p>
        </div>
        <Link
          href="/platform"
          className="flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:text-violet-900 bg-violet-100 hover:bg-violet-200 border border-violet-200 rounded-lg px-4 py-2 transition-all shrink-0"
        >
          Open Nexus Platform <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
