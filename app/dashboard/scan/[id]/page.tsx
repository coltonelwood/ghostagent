import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentsTable } from "@/components/dashboard/agents-table";
import { ScanProgress } from "@/components/dashboard/scan-progress";

export default async function ScanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: scan } = await supabase
    .from("scans")
    .select("*")
    .eq("id", id)
    .single();

  if (!scan) notFound();

  // Load max 200 agents, most critical first
  const { data: agents } = await supabase
    .from("agents")
    .select("*")
    .eq("scan_id", id)
    .order("risk_level", { ascending: true })
    .order("has_secrets", { ascending: false })
    .limit(200);

  const isRunning = ["pending", "scanning", "classifying"].includes(scan.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Scan {id.slice(0, 8)}
          </h1>
          <p className="text-muted-foreground">
            Started {new Date(scan.started_at).toLocaleString()}
          </p>
        </div>
        <Badge
          variant={scan.status === "completed" ? "default" : "secondary"}
          className="text-sm"
        >
          {scan.status}
        </Badge>
      </div>

      {isRunning && <ScanProgress scanId={id} />}

      {scan.status === "failed" && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Scan Failed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {scan.error_message ?? "An unexpected error occurred."}
            </p>
            <Link href="/dashboard">
              <Button variant="outline" size="sm">Run a new scan →</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Repos Scanned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scan.repos_scanned}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Agents Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scan.agents_found}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed At
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {scan.completed_at
                ? new Date(scan.completed_at).toLocaleTimeString()
                : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {agents && agents.length > 0 && <AgentsTable agents={agents} />}
    </div>
  );
}
