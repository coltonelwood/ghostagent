"use client";

import Link from "next/link";
import {
  Database,
  UserX,
  ShieldAlert,
  Plug,
  ArrowRight,
  CheckCircle2,
  Activity,
  ShieldCheck,
  ClipboardCheck,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { riskVariant } from "@/lib/design/risk";
import { eventSeverityMeta } from "@/lib/design/status";

interface AnalyticsData {
  totalAssets: number;
  assetsByKind: Record<string, number>;
  assetsBySource: Record<string, number>;
  assetsByRiskLevel: Record<string, number>;
  orphanedAssets: number;
  openViolations: number;
  criticalAssets: number;
  connectorCount: number;
  connectorsByStatus: Record<string, number>;
  recentEvents: Array<{
    id: string;
    kind: string;
    severity: string;
    title: string;
    created_at: string;
    asset_id: string | null;
  }>;
  complianceScore: number | null;
}

// --------------------------------------------------------------------------
// Empty state — the first-run dashboard a prospect sees
// --------------------------------------------------------------------------

function EmptyDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Your AI asset landscape will appear here once you connect a source."
      />

      <div className="nx-surface flex flex-col items-center gap-4 px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-lg border border-border bg-muted/40">
          <Plug className="size-5 text-muted-foreground/70" aria-hidden />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">
          Connect your first source to start scanning for AI agents
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Link GitHub, GitLab, AWS, or an automation platform. Spekris will scan
          for AI assets and surface risks automatically.
        </p>
        <Link
          href="/platform/connectors"
          className={buttonVariants({ size: "default" })}
        >
          Add connector
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Risk distribution chart — horizontal stacked bar + legend
// --------------------------------------------------------------------------

function RiskDistribution({ byLevel }: { byLevel: Record<string, number> }) {
  const levels = ["critical", "high", "medium", "low"] as const;
  const total = levels.reduce((sum, l) => sum + (byLevel[l] ?? 0), 0);

  return (
    <div className="nx-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold tracking-tight">
          Risk distribution
        </h3>
        <span className="text-xs text-muted-foreground nx-tabular">
          {total} total
        </span>
      </div>

      {total === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          No assets scored yet.
        </div>
      ) : (
        <>
          <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-muted">
            {levels.map((level) => {
              const count = byLevel[level] ?? 0;
              const pct = total > 0 ? (count / total) * 100 : 0;
              if (pct === 0) return null;
              const variant = riskVariant(level);
              return (
                <div
                  key={level}
                  className={cn("h-full", variant.dotClass)}
                  style={{ width: `${pct}%` }}
                  title={`${variant.label}: ${count}`}
                />
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {levels.map((level) => {
              const count = byLevel[level] ?? 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const variant = riskVariant(level);
              return (
                <div key={level} className="flex items-center gap-2">
                  <span
                    className={cn("size-2 rounded-full", variant.dotClass)}
                    aria-hidden
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {variant.label}
                    </span>
                    <span className="text-sm font-semibold nx-tabular">
                      {count}{" "}
                      <span className="text-[11px] font-normal text-muted-foreground">
                        ({pct}%)
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Source distribution — horizontal bars
// --------------------------------------------------------------------------

function SourceDistribution({ bySource }: { bySource: Record<string, number> }) {
  const entries = Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = entries[0]?.[1] ?? 0;

  return (
    <div className="nx-surface p-5">
      <h3 className="text-[13px] font-semibold tracking-tight">Assets by source</h3>
      {entries.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          No sources yet.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {entries.map(([source, count]) => {
            const pct = max > 0 ? (count / max) * 100 : 0;
            return (
              <div key={source} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="capitalize text-foreground">{source}</span>
                  <span className="nx-tabular text-muted-foreground">{count}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/80"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Recent events feed
// --------------------------------------------------------------------------

function RecentEvents({ events }: { events: AnalyticsData["recentEvents"] }) {
  return (
    <div className="nx-surface flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h3 className="text-[13px] font-semibold tracking-tight">Recent events</h3>
        <Link
          href="/platform/events"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          View all →
        </Link>
      </div>
      {events.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Activity className="mx-auto mb-2 size-5 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">
            Events will appear here as connectors sync and policies run.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {events.slice(0, 6).map((event) => {
            const meta = eventSeverityMeta(event.severity);
            return (
              <li key={event.id} className="flex items-start gap-3 px-5 py-3">
                <span
                  className={cn("mt-1.5 size-1.5 rounded-full shrink-0", meta.dotClass)}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {event.title}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className={cn("capitalize", meta.textClass)}>
                      {meta.label}
                    </span>
                    <span>·</span>
                    <span className="nx-tabular">
                      {formatRelative(event.created_at)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Connector health strip
// --------------------------------------------------------------------------

function ConnectorHealth({
  byStatus,
  total,
}: {
  byStatus: Record<string, number>;
  total: number;
}) {
  const entries = Object.entries(byStatus);

  return (
    <div className="nx-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold tracking-tight">
          Connector health
        </h3>
        <Link
          href="/platform/connectors"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Manage →
        </Link>
      </div>
      {total === 0 ? (
        <EmptyState
          variant="inline"
          icon={Plug}
          title="No connectors yet"
          description="Add your first connector to start discovering AI assets."
          primaryAction={
            <Link
              href="/platform/connectors"
              className={buttonVariants({ size: "sm" })}
            >
              Add connector
            </Link>
          }
        />
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {entries.map(([status, count]) => (
            <div
              key={status}
              className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-3"
            >
              <CheckCircle2
                className={cn(
                  "size-4",
                  status === "active" && "text-success",
                  status === "error" && "text-destructive",
                  status === "paused" && "text-warning",
                )}
              />
              <div>
                <p className="text-[11px] font-medium capitalize text-muted-foreground">
                  {status}
                </p>
                <p className="text-sm font-semibold nx-tabular">{count}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Clean-scan dashboard — shown when the user has active connectors but
// zero assets. Explicitly frames this as a GOOD result (no production
// AI surface detected) instead of a blank onboarding state. This is the
// "cal.com / outline-shaped customer" experience — their codebase is
// genuinely clean and the dashboard should celebrate that, not imply
// the product is broken.
// --------------------------------------------------------------------------

function CleanScanDashboard({ analytics }: { analytics: AnalyticsData }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Your production AI surface is currently clean."
      />

      <div className="nx-surface flex flex-col gap-6 p-6 sm:flex-row sm:items-start">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-md border border-success/20 bg-success/10">
          <ShieldCheck className="size-6 text-success" aria-hidden />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              No production AI assets detected
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Spekris scanned{" "}
              <span className="nx-tabular font-medium text-foreground">
                {analytics.connectorCount}
              </span>{" "}
              connected source
              {analytics.connectorCount === 1 ? "" : "s"} and found no
              operational AI systems in your environment. This is a real,
              positive result — it means no undisclosed LLM integrations,
              orphaned models, or unmonitored automation were found in the
              paths we scanned.
            </p>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-4 text-[13px] leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">What this result means</p>
            <ul className="mt-2 space-y-1.5 list-disc list-inside">
              <li>
                No code files in your scanned repos match known LLM SDK
                signatures.
              </li>
              <li>
                No dependency manifests declare AI providers like{" "}
                <span className="nx-mono">openai</span>,{" "}
                <span className="nx-mono">anthropic</span>, or{" "}
                <span className="nx-mono">langchain</span>.
              </li>
              <li>
                No <span className="nx-mono">.env.example</span> files
                reference AI API keys.
              </li>
              <li>
                Developer-tooling configurations like{" "}
                <span className="nx-mono">.cursor/</span> or{" "}
                <span className="nx-mono">agents/rules/</span> are classified
                as non-operational and excluded from risk scoring.
              </li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground/80">
            Keep in mind: a clean scan reflects what we could see in the
            repositories and file paths we inspected. If your team ships AI
            through separate plugin repositories, external services, or
            unconnected environments, those won&apos;t appear here. Connect
            additional sources or review your connector configuration below to
            widen coverage.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Link
              href="/platform/connectors"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Review connectors
              <ArrowRight className="size-3.5" />
            </Link>
            <Link
              href="/platform/events"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              View scan events
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Sources connected"
          value={analytics.connectorCount}
          icon={Plug}
          description="Actively syncing"
          href="/platform/connectors"
        />
        <StatCard
          label="Assets discovered"
          value={0}
          icon={Database}
          tone="success"
          description="Clean — nothing operational"
        />
        <StatCard
          label="Open violations"
          value={analytics.openViolations}
          icon={ShieldAlert}
          tone={analytics.openViolations > 0 ? "warning" : "success"}
          description={
            analytics.openViolations > 0
              ? "Policy breaches still need attention"
              : "None"
          }
          href="/platform/policies"
        />
      </div>

      {analytics.recentEvents.length > 0 && (
        <RecentEvents events={analytics.recentEvents} />
      )}

      <p className="text-[11px] text-muted-foreground/70">
        Spekris surfaces evidence to support governance and compliance work. A
        clean scan is a snapshot of what we observed in the sources you
        connected — re-run scans regularly or add more sources to broaden
        coverage.
      </p>
    </div>
  );
}

// --------------------------------------------------------------------------
// Main dashboard
// --------------------------------------------------------------------------

export function CommandCenterDashboard({
  analytics,
}: {
  analytics: AnalyticsData | null;
}) {
  // Three states:
  //   1. Analytics missing OR no connectors → true "never scanned" onboarding
  //   2. Connectors exist but zero assets → "clean scan" positive result
  //   3. Assets exist → full dashboard
  if (!analytics || analytics.connectorCount === 0) {
    return <EmptyDashboard />;
  }
  if (analytics.totalAssets === 0) {
    return <CleanScanDashboard analytics={analytics} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="AI asset risk posture across your connected sources."
      />

      {/* Hero metric — total AI assets */}
      <div className="nx-surface flex flex-col items-center gap-2 p-8 text-center sm:flex-row sm:items-start sm:gap-8 sm:text-left">
        <div className="flex flex-col items-center sm:items-start">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total AI assets found
          </span>
          <Link href="/platform/assets" className="group">
            <span className="text-5xl font-bold leading-none nx-tabular text-foreground group-hover:text-primary transition-colors">
              {analytics.totalAssets}
            </span>
          </Link>
          <span className="mt-1 text-xs text-muted-foreground">
            across {analytics.connectorCount} connected source{analytics.connectorCount === 1 ? "" : "s"}
          </span>
        </div>

        {/* Risk breakdown — color-coded inline */}
        <div className="flex flex-1 items-center justify-center gap-4 sm:justify-end">
          {(["critical", "high", "medium", "low"] as const).map((level) => {
            const count = analytics.assetsByRiskLevel[level] ?? 0;
            const variant = riskVariant(level);
            return (
              <Link
                key={level}
                href={`/platform/assets?risk=${level}`}
                className="flex flex-col items-center gap-1 rounded-md px-3 py-2 transition-colors hover:bg-muted/60"
              >
                <span className={cn("text-2xl font-bold nx-tabular", variant.textClass)}>
                  {count}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <span className={cn("size-2 rounded-full", variant.dotClass)} aria-hidden />
                  {variant.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Risk distribution bar */}
      <RiskDistribution byLevel={analytics.assetsByRiskLevel} />

      {/* Recent activity + scan action */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentEvents events={analytics.recentEvents} />
        <SourceDistribution bySource={analytics.assetsBySource} />
      </div>

      {/* Quick links — collapsed secondary info */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Link
          href="/platform/policies"
          className="nx-surface flex items-center gap-3 p-4 transition-colors hover:border-border-strong"
        >
          <ShieldAlert className="size-4 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-semibold nx-tabular">{analytics.openViolations}</p>
            <p className="text-[11px] text-muted-foreground">Open violations</p>
          </div>
        </Link>
        <Link
          href="/platform/assets?owner=orphaned"
          className="nx-surface flex items-center gap-3 p-4 transition-colors hover:border-border-strong"
        >
          <UserX className="size-4 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-semibold nx-tabular">{analytics.orphanedAssets}</p>
            <p className="text-[11px] text-muted-foreground">Orphaned assets</p>
          </div>
        </Link>
        {analytics.complianceScore !== null && (
          <Link
            href="/platform/compliance"
            className="nx-surface flex items-center gap-3 p-4 transition-colors hover:border-border-strong"
          >
            <ClipboardCheck className="size-4 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-semibold nx-tabular">{analytics.complianceScore}%</p>
              <p className="text-[11px] text-muted-foreground">Compliance</p>
            </div>
          </Link>
        )}
        <Link
          href="/platform/connectors"
          className="nx-surface flex items-center gap-3 p-4 transition-colors hover:border-border-strong"
        >
          <Plug className="size-4 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-semibold nx-tabular">{analytics.connectorCount}</p>
            <p className="text-[11px] text-muted-foreground">Connectors</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
