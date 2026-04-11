"use client";

import Link from "next/link";
import {
  Database,
  AlertTriangle,
  UserX,
  ShieldAlert,
  Plug,
  ArrowRight,
  CheckCircle2,
  Activity,
  Clock,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
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
  const steps = [
    {
      step: "01",
      title: "Connect a source",
      description:
        "Link GitHub, GitLab, AWS, or an automation platform. Credentials are encrypted with AES-256-GCM before storage.",
      cta: "Add connector",
      href: "/platform/connectors",
      active: true,
    },
    {
      step: "02",
      title: "Run your first sync",
      description:
        "Nexus scans connected sources and surfaces every AI asset it finds — models, LLM integrations, feature flags, automations.",
      cta: "Review sources",
      href: "/platform/connectors",
      active: false,
    },
    {
      step: "03",
      title: "Review the registry",
      description:
        "Each asset gets a risk score, owner, and compliance mapping. Set policies to enforce governance automatically.",
      cta: "Open registry",
      href: "/platform/assets",
      active: false,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Your AI asset landscape will appear here once you connect a source."
        secondaryActions={
          <Link
            href="/demo"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            See a sample scan
            <ArrowRight className="size-3.5" />
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {steps.map((item) => (
          <div
            key={item.step}
            className={cn(
              "nx-surface flex flex-col gap-3 p-5",
              item.active && "ring-1 ring-primary/30",
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "nx-mono text-[11px] font-semibold",
                  item.active ? "text-primary" : "text-muted-foreground",
                )}
              >
                Step {item.step}
              </span>
              {item.active && (
                <span className="inline-flex items-center gap-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                  Start here
                </span>
              )}
            </div>
            <h3 className="text-base font-semibold tracking-tight">
              {item.title}
            </h3>
            <p className="flex-1 text-[13px] leading-relaxed text-muted-foreground">
              {item.description}
            </p>
            <Link
              href={item.href}
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium",
                item.active
                  ? "text-primary hover:underline"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.cta} <ArrowRight className="size-3" />
            </Link>
          </div>
        ))}
      </div>

      <div className="nx-surface p-5">
        <h3 className="text-[13px] font-semibold tracking-tight">
          Supported sources
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Ten integrations across code, cloud, automation, and HR.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            "GitHub",
            "GitLab",
            "AWS",
            "Azure",
            "GCP",
            "Zapier",
            "n8n",
            "Make",
            "BambooHR",
            "Rippling",
          ].map((name) => (
            <span
              key={name}
              className="inline-flex h-7 items-center rounded-sm border border-border px-2 text-xs text-muted-foreground"
            >
              {name}
            </span>
          ))}
        </div>
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
// Main dashboard
// --------------------------------------------------------------------------

export function CommandCenterDashboard({
  analytics,
}: {
  analytics: AnalyticsData | null;
}) {
  if (!analytics || analytics.totalAssets === 0) {
    return <EmptyDashboard />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="AI asset risk posture across your connected sources."
        primaryAction={
          <Link
            href="/platform/reports"
            className={buttonVariants({ size: "sm" })}
          >
            Export report
            <ArrowRight className="size-3.5" />
          </Link>
        }
        secondaryActions={
          <div className="hidden items-center gap-1 rounded-md border border-border p-0.5 text-xs sm:flex">
            {["7d", "30d", "90d"].map((range, i) => (
              <button
                key={range}
                className={cn(
                  "h-6 rounded-sm px-2 font-medium transition-colors",
                  i === 1
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {range}
              </button>
            ))}
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total assets"
          value={analytics.totalAssets}
          icon={Database}
          description="Active AI systems"
          href="/platform/assets"
        />
        <StatCard
          label="Critical risk"
          value={analytics.criticalAssets}
          icon={AlertTriangle}
          tone={analytics.criticalAssets > 0 ? "danger" : "neutral"}
          description={
            analytics.criticalAssets > 0 ? "Require attention" : "Clean"
          }
          href="/platform/assets?risk=critical"
        />
        <StatCard
          label="Orphaned"
          value={analytics.orphanedAssets}
          icon={UserX}
          tone={analytics.orphanedAssets > 0 ? "warning" : "neutral"}
          description={
            analytics.orphanedAssets > 0
              ? "No active owner"
              : "Every asset has an owner"
          }
          href="/platform/assets?owner=orphaned"
        />
        <StatCard
          label="Open violations"
          value={analytics.openViolations}
          icon={ShieldAlert}
          tone={analytics.openViolations > 0 ? "warning" : "neutral"}
          description={
            analytics.openViolations > 0 ? "Policy breaches" : "All clear"
          }
          href="/platform/policies"
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RiskDistribution byLevel={analytics.assetsByRiskLevel} />
        <SourceDistribution bySource={analytics.assetsBySource} />
      </div>

      {/* Events + connectors */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentEvents events={analytics.recentEvents} />
        <ConnectorHealth
          byStatus={analytics.connectorsByStatus}
          total={analytics.connectorCount}
        />
      </div>

      {/* Compliance footer */}
      {analytics.complianceScore !== null && (
        <div className="nx-surface flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-md bg-primary/10">
              <ClockIcon />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold tracking-tight">
                Compliance coverage
              </h3>
              <p className="text-xs text-muted-foreground">
                {analytics.complianceScore}% of mapped controls have evidence.
              </p>
            </div>
          </div>
          <Link
            href="/platform/compliance"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Review frameworks
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}

      {/* Safety / disclaimer strip */}
      <p className="text-[11px] text-muted-foreground/70">
        Nexus surfaces evidence to support governance and compliance work. It
        does not certify compliance or replace a qualified auditor.
      </p>
    </div>
  );
}

// --------------------------------------------------------------------------

function ClockIcon() {
  return <Clock className="size-5 text-primary" />;
}

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
