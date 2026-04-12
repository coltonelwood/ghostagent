import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { RiskBadge } from "@/components/ui/risk-badge";
import { cn } from "@/lib/utils";
import {
  Database,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Beaker,
} from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Self-learning engine admin page. Gated on both the
 * NEXUS_LEARNING_ENABLED feature flag AND the caller's email appearing
 * in LEARNING_ADMIN_EMAILS. Non-admins get a 404 so the route doesn't
 * advertise the engine's existence.
 */
export default async function LearningPage() {
  if (process.env.NEXUS_LEARNING_ENABLED !== "true") notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?redirectTo=/platform/learning");

  const allowed = (process.env.LEARNING_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const email = (user.email ?? "").toLowerCase();
  if (!allowed.includes(email)) notFound();

  const db = getAdminClient();
  const [
    projectsRes,
    recentScansRes,
    openMistakesRes,
    proposalsRes,
  ] = await Promise.all([
    db
      .from("learning_projects")
      .select("*")
      .order("ingested_at", { ascending: false })
      .limit(20),
    db
      .from("learning_scans")
      .select("*, learning_projects(label)")
      .order("started_at", { ascending: false })
      .limit(20),
    db
      .from("learning_mistakes")
      .select("*, learning_projects(label)")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("learning_improvements")
      .select("*")
      .eq("status", "proposed")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const projects = projectsRes.data ?? [];
  const recentScans = recentScansRes.data ?? [];
  const openMistakes = openMistakesRes.data ?? [];
  const proposals = proposalsRes.data ?? [];

  const completedScans = recentScans.filter((s) => s.status === "completed");
  const totalFindings = completedScans.reduce(
    (sum, s) => sum + (s.total_findings ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning engine"
        description="Internal self-learning surface. Ingest real projects, execute real detection, review mistakes, propose improvements. Never auto-applies changes."
        meta={
          <>
            <span className="nx-tabular">{projects.length}</span>
            <span>projects</span>
            <span>·</span>
            <span className="nx-tabular">{recentScans.length}</span>
            <span>recent scans</span>
            <span>·</span>
            <span
              className={cn(
                "nx-tabular",
                openMistakes.length > 0 && "text-warning",
              )}
            >
              {openMistakes.length}
            </span>
            <span>open mistakes</span>
            <span>·</span>
            <span className="nx-tabular">{proposals.length}</span>
            <span>proposed improvements</span>
          </>
        }
      />

      <div className="rounded-lg border border-info/20 bg-info/5 p-4 text-[13px] leading-relaxed text-foreground">
        <p>
          <strong>Design invariant:</strong> this engine runs real detection
          against stored project content (not simulated) and writes proposals,
          not code. A human operator must review each proposal and update
          source files manually before marking an improvement{" "}
          <span className="nx-mono">applied</span>.
        </p>
      </div>

      {/* Projects */}
      <section className="nx-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-[13px] font-semibold tracking-tight">
            Ingested projects
          </h3>
          <span className="text-[11px] text-muted-foreground nx-tabular">
            {projects.length} total
          </span>
        </div>
        {projects.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={Database}
            title="No projects ingested yet"
            description="POST a project to /api/learning/projects to start the loop."
          />
        ) : (
          <ul className="divide-y divide-border">
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex items-start justify-between gap-4 px-5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{p.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {p.source_type} ·{" "}
                    {p.source_url ?? "no source url"} · ingested{" "}
                    {new Date(p.ingested_at).toLocaleString()}
                  </p>
                </div>
                <span className="nx-mono text-[10px] text-muted-foreground/70">
                  {p.id.slice(0, 8)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent scans */}
      <section className="nx-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-[13px] font-semibold tracking-tight">
            Recent scans
          </h3>
          <span className="text-[11px] text-muted-foreground">
            <Beaker className="inline size-3 mr-1" />
            {totalFindings} findings across {completedScans.length} completed
          </span>
        </div>
        {recentScans.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={Activity}
            title="No scans yet"
          />
        ) : (
          <ul className="divide-y divide-border">
            {recentScans.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {(s as unknown as { learning_projects?: { label: string } }).learning_projects?.label ?? s.project_id}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {s.engine_version} · {s.status} ·{" "}
                    {s.completed_at
                      ? `${s.duration_ms}ms`
                      : "running"}{" "}
                    · findings: {s.total_findings} (code {s.code_findings},
                    manifest {s.manifest_findings}, env {s.env_findings})
                  </p>
                </div>
                <span
                  className={cn(
                    "text-[11px] nx-tabular",
                    s.status === "completed" && "text-success",
                    s.status === "failed" && "text-destructive",
                    s.status === "running" && "text-info animate-pulse",
                  )}
                >
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Mistakes */}
      <section className="nx-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-[13px] font-semibold tracking-tight">
            Open mistakes
          </h3>
          <span className="text-[11px] text-muted-foreground nx-tabular">
            {openMistakes.length} to review
          </span>
        </div>
        {openMistakes.length === 0 ? (
          <div className="px-5 py-6 text-center text-[12px] text-muted-foreground">
            <CheckCircle2 className="mx-auto mb-2 size-5 text-success/70" />
            No open mistakes. The last scan agreed with the rule set.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {openMistakes.map((m) => (
              <li key={m.id} className="flex items-start gap-3 px-5 py-3">
                <AlertTriangle className="mt-1 size-3.5 shrink-0 text-warning" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <RiskBadge level={m.severity} size="sm" />
                    <span className="text-[11px] text-muted-foreground">
                      {m.mistake_type}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-foreground">
                    {m.description}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {(m as unknown as { learning_projects?: { label: string } }).learning_projects?.label ?? m.project_id}
                    {" · "}
                    {new Date(m.created_at).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Proposals */}
      <section className="nx-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-[13px] font-semibold tracking-tight">
            Proposed improvements
          </h3>
          <span className="text-[11px] text-muted-foreground nx-tabular">
            {proposals.length} awaiting review
          </span>
        </div>
        {proposals.length === 0 ? (
          <div className="px-5 py-6 text-center text-[12px] text-muted-foreground">
            <Lightbulb className="mx-auto mb-2 size-5 text-muted-foreground/50" />
            No pending proposals. The engine has nothing new to suggest.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {proposals.map((p) => (
              <li key={p.id} className="flex items-start gap-3 px-5 py-3">
                <Lightbulb className="mt-1 size-3.5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">{p.title}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    {p.rationale}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/80">
                    {p.improvement_type} ·{" "}
                    {new Date(p.created_at).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[11px] text-muted-foreground/70">
        This surface is only visible to operators whose email is in{" "}
        <span className="nx-mono">LEARNING_ADMIN_EMAILS</span>. Gate it entirely
        by unsetting <span className="nx-mono">NEXUS_LEARNING_ENABLED</span> in
        production.
      </p>
    </div>
  );
}
