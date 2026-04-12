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
// Clean-scan dashboard — connectors exist but zero assets found
// --------------------------------------------------------------------------

function CleanScanDashboard({ analytics }: { analytics: AnalyticsData }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Your production AI surface is currently clean."
      />

      <div className="nx-surface flex flex-col items-center gap-4 px-6 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full border border-success/20 bg-success/10">
          <ShieldCheck className="size-6 text-success" aria-hidden />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">
          No AI agents detected
        </h2>
        <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
          Scanned {analytics.connectorCount} source{analytics.connectorCount === 1 ? "" : "s"} and
          found no operational AI. Connect more sources to broaden coverage.
        </p>
        <Link
          href="/platform/connectors"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Add more sources
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {analytics.recentEvents.length > 0 && (
        <RecentEvents events={analytics.recentEvents} />
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Insights — actionable recommendations based on scan data
// --------------------------------------------------------------------------

interface Insight {
  severity: "critical" | "warning" | "info" | "success";
  title: string;
  description: string;
  href: string;
  action: string;
}

function generateInsights(analytics: AnalyticsData): Insight[] {
  const insights: Insight[] = [];

  const critical = analytics.assetsByRiskLevel["critical"] ?? 0;
  const high = analytics.assetsByRiskLevel["high"] ?? 0;

  if (critical > 0) {
    insights.push({
      severity: "critical",
      title: `${critical} critical-risk AI asset${critical === 1 ? "" : "s"} need immediate review`,
      description: "These assets pose the highest governance risk — unmonitored, unowned, or using sensitive data.",
      href: "/platform/assets?risk=critical",
      action: "Review now",
    });
  }

  if (analytics.orphanedAssets > 0) {
    insights.push({
      severity: "warning",
      title: `${analytics.orphanedAssets} AI asset${analytics.orphanedAssets === 1 ? "" : "s"} have no owner`,
      description: "Unowned AI agents are a compliance gap. Assign an owner so someone is accountable.",
      href: "/platform/assets?owner=orphaned",
      action: "Assign owners",
    });
  }

  if (analytics.openViolations > 0) {
    insights.push({
      severity: "warning",
      title: `${analytics.openViolations} open policy violation${analytics.openViolations === 1 ? "" : "s"}`,
      description: "These assets breach your governance policies and need attention.",
      href: "/platform/policies",
      action: "View violations",
    });
  }

  if (high > 0 && critical === 0) {
    insights.push({
      severity: "warning",
      title: `${high} high-risk asset${high === 1 ? "" : "s"} detected`,
      description: "No critical issues, but these assets should be reviewed for proper governance.",
      href: "/platform/assets?risk=high",
      action: "Review assets",
    });
  }

  if (analytics.connectorCount === 1) {
    insights.push({
      severity: "info",
      title: "Only 1 source connected",
      description: "Connect more sources (GitLab, AWS, cloud platforms) to get full visibility across your org.",
      href: "/platform/connectors",
      action: "Add source",
    });
  }

  if (analytics.complianceScore !== null && analytics.complianceScore < 70) {
    insights.push({
      severity: "warning",
      title: `Compliance score is ${analytics.complianceScore}%`,
      description: "Review your compliance gaps and address the top issues to improve your posture.",
      href: "/platform/compliance",
      action: "View gaps",
    });
  }

  if (insights.length === 0) {
    insights.push({
      severity: "success",
      title: "Looking good — no urgent issues",
      description: "All AI assets are owned, no policy violations, and risk levels are under control.",
      href: "/platform/assets",
      action: "View assets",
    });
  }

  return insights.slice(0, 4);
}

const insightStyles = {
  critical: {
    border: "border-destructive/30",
    bg: "bg-destructive/5",
    dot: "bg-destructive",
    text: "text-destructive",
  },
  warning: {
    border: "border-warning/30",
    bg: "bg-warning/5",
    dot: "bg-warning",
    text: "text-warning",
  },
  info: {
    border: "border-primary/30",
    bg: "bg-primary/5",
    dot: "bg-primary",
    text: "text-primary",
  },
  success: {
    border: "border-success/30",
    bg: "bg-success/5",
    dot: "bg-success",
    text: "text-success",
  },
} as const;

function InsightsPanel({ analytics }: { analytics: AnalyticsData }) {
  const insights = generateInsights(analytics);

  return (
    <div className="space-y-3">
      <h3 className="text-[13px] font-semibold tracking-tight">
        Recommended actions
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {insights.map((insight, i) => {
          const style = insightStyles[insight.severity];
          return (
            <Link
              key={i}
              href={insight.href}
              className={cn(
                "nx-surface flex flex-col gap-2 p-4 transition-colors hover:border-border-strong",
                style.border,
                style.bg,
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full shrink-0", style.dot)} />
                <span className="text-[13px] font-semibold text-foreground leading-snug">
                  {insight.title}
                </span>
              </div>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                {insight.description}
              </p>
              <span className={cn("text-[12px] font-medium mt-auto", style.text)}>
                {insight.action} →
              </span>
            </Link>
          );
        })}
      </div>
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

      {/* Insights — actionable recommendations */}
      <InsightsPanel analytics={analytics} />

      {/* Risk distribution bar */}
      <RiskDistribution byLevel={analytics.assetsByRiskLevel} />

      {/* Recent activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentEvents events={analytics.recentEvents} />
        <SourceDistribution bySource={analytics.assetsBySource} />
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
