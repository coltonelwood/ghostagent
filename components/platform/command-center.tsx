"use client";

import Link from "next/link";
import {
  Database,
  UserX,
  ShieldAlert,
  Plug,
  ArrowRight,
  Activity,
  ShieldCheck,
  AlertTriangle,
  Eye,
  Lock,
  ExternalLink,
  ClipboardCheck,
  Bot,
  Code,
  Workflow,
  Zap,
  FileCode,
  Box,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { riskVariant } from "@/lib/design/risk";
import { eventSeverityMeta } from "@/lib/design/status";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface TopRiskAsset {
  id: string;
  name: string;
  kind: string;
  risk_level: string;
  risk_score: number;
  owner_email: string | null;
  owner_status: string;
  source: string;
  environment: string;
  description: string | null;
}

interface AnalyticsData {
  totalAssets: number;
  assetsByKind: Record<string, number>;
  assetsBySource: Record<string, number>;
  assetsByEnvironment: Record<string, number>;
  assetsByRiskLevel: Record<string, number>;
  orphanedAssets: number;
  openViolations: number;
  criticalAssets: number;
  sensitiveDataAssets: number;
  connectorCount: number;
  connectorsByStatus: Record<string, number>;
  lastSyncAt: string | null;
  recentEvents: Array<{
    id: string;
    kind: string;
    severity: string;
    title: string;
    created_at: string;
    asset_id: string | null;
  }>;
  topRiskAssets: TopRiskAsset[];
  complianceScore: number | null;
}

// --------------------------------------------------------------------------
// Helpers
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

const KIND_LABELS: Record<string, { label: string; icon: typeof Bot }> = {
  agent:        { label: "Agents",        icon: Bot },
  pipeline:     { label: "Pipelines",     icon: Workflow },
  workflow:     { label: "Workflows",     icon: Workflow },
  function:     { label: "Functions",     icon: Zap },
  script:       { label: "Scripts",       icon: FileCode },
  model:        { label: "Models",        icon: Box },
  integration:  { label: "Integrations",  icon: Plug },
  api:          { label: "APIs",          icon: Code },
  sdk_reported: { label: "SDK Reported",  icon: Code },
  unknown:      { label: "Other",         icon: Code },
};

const OWNER_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  orphaned: "No owner",
  unknown: "Unknown",
  reassignment_pending: "Reassigning",
};

const ENV_ORDER = ["production", "staging", "development", "unknown"] as const;
const ENV_COLORS: Record<string, string> = {
  production: "bg-destructive/80",
  staging: "bg-warning/80",
  development: "bg-primary/60",
  unknown: "bg-muted-foreground/40",
};

// --------------------------------------------------------------------------
// Signal cards (top-level metrics)
// --------------------------------------------------------------------------

function SignalCards({ analytics }: { analytics: AnalyticsData }) {
  const critHigh = (analytics.assetsByRiskLevel["critical"] ?? 0) + (analytics.assetsByRiskLevel["high"] ?? 0);
  const critHighTone = critHigh > 0 ? "text-destructive" : "text-success";

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Link href="/platform/assets" className="nx-surface flex items-center gap-4 p-4 transition-colors hover:border-border-strong">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Database className="size-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold nx-tabular leading-none">{analytics.totalAssets}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">AI systems detected</p>
        </div>
      </Link>

      <Link href="/platform/assets?owner=orphaned" className="nx-surface flex items-center gap-4 p-4 transition-colors hover:border-border-strong">
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", analytics.orphanedAssets > 0 ? "bg-warning/10" : "bg-success/10")}>
          <UserX className={cn("size-5", analytics.orphanedAssets > 0 ? "text-warning" : "text-success")} />
        </div>
        <div>
          <p className="text-2xl font-bold nx-tabular leading-none">{analytics.orphanedAssets}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">No owner assigned</p>
        </div>
      </Link>

      <Link href="/platform/assets?risk=critical,high" className="nx-surface flex items-center gap-4 p-4 transition-colors hover:border-border-strong">
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", critHigh > 0 ? "bg-destructive/10" : "bg-success/10")}>
          <ShieldAlert className={cn("size-5", critHighTone)} />
        </div>
        <div>
          <p className={cn("text-2xl font-bold nx-tabular leading-none", critHighTone)}>{critHigh}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">High / critical risk</p>
        </div>
      </Link>

      <Link href="/platform/assets" className="nx-surface flex items-center gap-4 p-4 transition-colors hover:border-border-strong">
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", analytics.sensitiveDataAssets > 0 ? "bg-warning/10" : "bg-muted")}>
          <Lock className={cn("size-5", analytics.sensitiveDataAssets > 0 ? "text-warning" : "text-muted-foreground")} />
        </div>
        <div>
          <p className="text-2xl font-bold nx-tabular leading-none">{analytics.sensitiveDataAssets}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Using sensitive data</p>
        </div>
      </Link>
    </div>
  );
}

// --------------------------------------------------------------------------
// Status strip — compliance, violations, connectors, last scan
// --------------------------------------------------------------------------

function StatusStrip({ analytics }: { analytics: AnalyticsData }) {
  const activeConnectors = analytics.connectorsByStatus["active"] ?? 0;
  const errorConnectors = analytics.connectorsByStatus["error"] ?? 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {analytics.complianceScore !== null && (
        <Link href="/platform/compliance" className="nx-surface flex items-center gap-3 p-3 transition-colors hover:border-border-strong">
          <ClipboardCheck className={cn("size-4 shrink-0", analytics.complianceScore >= 70 ? "text-success" : analytics.complianceScore >= 40 ? "text-warning" : "text-destructive")} />
          <div className="min-w-0">
            <p className={cn("text-sm font-bold nx-tabular", analytics.complianceScore >= 70 ? "text-success" : analytics.complianceScore >= 40 ? "text-warning" : "text-destructive")}>
              {analytics.complianceScore}%
            </p>
            <p className="text-[11px] text-muted-foreground">Compliance score</p>
          </div>
        </Link>
      )}

      <Link href="/platform/policies" className="nx-surface flex items-center gap-3 p-3 transition-colors hover:border-border-strong">
        <ShieldAlert className={cn("size-4 shrink-0", analytics.openViolations > 0 ? "text-warning" : "text-success")} />
        <div className="min-w-0">
          <p className="text-sm font-bold nx-tabular">{analytics.openViolations}</p>
          <p className="text-[11px] text-muted-foreground">Open violations</p>
        </div>
      </Link>

      <Link href="/platform/connectors" className="nx-surface flex items-center gap-3 p-3 transition-colors hover:border-border-strong">
        {errorConnectors > 0 ? (
          <XCircle className="size-4 shrink-0 text-destructive" />
        ) : (
          <CheckCircle2 className="size-4 shrink-0 text-success" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold nx-tabular">
            {activeConnectors} active
            {errorConnectors > 0 && <span className="text-destructive"> · {errorConnectors} error</span>}
          </p>
          <p className="text-[11px] text-muted-foreground">Connected sources</p>
        </div>
      </Link>

      <div className="nx-surface flex items-center gap-3 p-3">
        <Clock className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium nx-tabular">
            {analytics.lastSyncAt ? formatRelative(analytics.lastSyncAt) : "Never"}
          </p>
          <p className="text-[11px] text-muted-foreground">Last scan</p>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Ownership coverage
// --------------------------------------------------------------------------

function OwnershipCoverage({ analytics }: { analytics: AnalyticsData }) {
  const owned = analytics.totalAssets - analytics.orphanedAssets;
  const pct = analytics.totalAssets > 0 ? Math.round((owned / analytics.totalAssets) * 100) : 0;
  const barColor = pct >= 80 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-destructive";
  const textColor = pct >= 80 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive";

  return (
    <Link href="/platform/assets?owner=orphaned" className="nx-surface flex items-center gap-5 p-5 transition-colors hover:border-border-strong">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold tracking-tight">AI Ownership Coverage</h3>
          <span className={cn("text-lg font-bold nx-tabular", textColor)}>{pct}%</span>
        </div>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">
          {owned} of {analytics.totalAssets} AI system{analytics.totalAssets === 1 ? "" : "s"} have a clear owner.
          {analytics.orphanedAssets > 0 && (
            <span className="font-medium text-foreground"> {analytics.orphanedAssets} need attention.</span>
          )}
        </p>
      </div>
    </Link>
  );
}

// --------------------------------------------------------------------------
// Systems by type — icon grid
// --------------------------------------------------------------------------

function SystemsByType({ byKind }: { byKind: Record<string, number> }) {
  const entries = Object.entries(byKind)
    .map(([kind, count]) => ({ kind, count, ...(KIND_LABELS[kind] ?? KIND_LABELS["unknown"]) }))
    .sort((a, b) => b.count - a.count);
  if (entries.length === 0) return null;

  return (
    <div className="nx-surface p-5">
      <h3 className="text-[13px] font-semibold tracking-tight">Systems by type</h3>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {entries.map(({ kind, count, label, icon: Icon }) => (
          <Link
            key={kind}
            href={`/platform/assets?kind=${kind}`}
            className="flex items-center gap-3 rounded-md border border-transparent p-2.5 transition-colors hover:border-border hover:bg-muted/40"
          >
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold nx-tabular leading-none">{count}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Environment breakdown
// --------------------------------------------------------------------------

function EnvironmentBreakdown({ byEnv }: { byEnv: Record<string, number> }) {
  const total = Object.values(byEnv).reduce((s, n) => s + n, 0);
  if (total === 0) return null;

  return (
    <div className="nx-surface p-5">
      <h3 className="text-[13px] font-semibold tracking-tight">Systems by environment</h3>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted">
        {ENV_ORDER.map((env) => {
          const count = byEnv[env] ?? 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={env}
              className={cn("h-full", ENV_COLORS[env] ?? "bg-muted-foreground/40")}
              style={{ width: `${pct}%` }}
              title={`${env}: ${count}`}
            />
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {ENV_ORDER.map((env) => {
          const count = byEnv[env] ?? 0;
          if (count === 0) return null;
          return (
            <div key={env} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn("size-2 rounded-full", ENV_COLORS[env])} aria-hidden />
              <span className="capitalize">{env}</span>: <span className="font-semibold nx-tabular">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Highest risk systems
// --------------------------------------------------------------------------

function HighestRiskSystems({ assets }: { assets: TopRiskAsset[] }) {
  const risky = assets.filter((a) => a.risk_level === "critical" || a.risk_level === "high");
  if (risky.length === 0) return null;

  return (
    <div className="nx-surface flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-destructive" />
          <h3 className="text-[13px] font-semibold tracking-tight">Highest risk systems</h3>
        </div>
        <Link href="/platform/assets?risk=critical,high" className="text-xs text-muted-foreground hover:text-foreground">
          View all →
        </Link>
      </div>
      <ul className="divide-y divide-border">
        {risky.slice(0, 5).map((asset) => {
          const rv = riskVariant(asset.risk_level);
          const kindMeta = KIND_LABELS[asset.kind] ?? KIND_LABELS["unknown"];
          return (
            <li key={asset.id} className="flex items-center gap-4 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/platform/assets/${asset.id}`} className="text-[13px] font-semibold text-foreground hover:text-primary truncate">
                    {asset.name}
                  </Link>
                  <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium border", rv.badgeClass ?? `border-current/20 ${rv.textClass}`)}>
                    {rv.label}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-muted-foreground truncate">
                  {kindMeta.label} · {asset.source} · {asset.environment}
                  {asset.owner_status === "orphaned" && " · No owner"}
                </p>
              </div>
              <div className="hidden sm:block shrink-0 text-right">
                <span className={cn("text-sm font-bold nx-tabular", rv.textClass)}>{asset.risk_score}</span>
                <p className="text-[11px] text-muted-foreground">risk score</p>
              </div>
              <Link href={`/platform/assets/${asset.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Eye className="size-3.5" />
                Review
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// --------------------------------------------------------------------------
// Risk distribution
// --------------------------------------------------------------------------

function RiskBar({ byLevel }: { byLevel: Record<string, number> }) {
  const levels = ["critical", "high", "medium", "low"] as const;
  const total = levels.reduce((sum, l) => sum + (byLevel[l] ?? 0), 0);
  if (total === 0) return null;

  return (
    <div className="nx-surface p-5">
      <h3 className="text-[13px] font-semibold tracking-tight mb-4">Risk distribution</h3>
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {levels.map((level) => {
          const count = byLevel[level] ?? 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          if (pct === 0) return null;
          const variant = riskVariant(level);
          return (
            <Link key={level} href={`/platform/assets?risk=${level}`} className={cn("h-full transition-opacity hover:opacity-80", variant.dotClass)} style={{ width: `${pct}%` }} title={`${variant.label}: ${count}`} />
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between">
        {levels.map((level) => {
          const count = byLevel[level] ?? 0;
          const variant = riskVariant(level);
          return (
            <Link key={level} href={`/platform/assets?risk=${level}`} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground">
              <span className={cn("size-2 rounded-full", variant.dotClass)} aria-hidden />
              {variant.label}: <span className="font-semibold nx-tabular">{count}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// What's happening — event feed
// --------------------------------------------------------------------------

function WhatsHappening({ events }: { events: AnalyticsData["recentEvents"] }) {
  return (
    <div className="nx-surface flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h3 className="text-[13px] font-semibold tracking-tight">What&apos;s happening</h3>
        <Link href="/platform/events" className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>
      </div>
      {events.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Activity className="mx-auto mb-2 size-5 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">Activity will appear here as sources sync and policies run.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {events.slice(0, 6).map((event) => {
            const meta = eventSeverityMeta(event.severity);
            return (
              <li key={event.id} className="flex items-start gap-3 px-5 py-3">
                <span className={cn("mt-1.5 size-2 rounded-full shrink-0", meta.dotClass)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-foreground leading-snug">{event.title}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className={cn("capitalize", meta.textClass)}>{meta.label}</span>
                    <span>·</span>
                    <span className="nx-tabular">{formatRelative(event.created_at)}</span>
                  </div>
                </div>
                {event.asset_id && (
                  <Link href={`/platform/assets/${event.asset_id}`} className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground">View →</Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Source breakdown
// --------------------------------------------------------------------------

function SourceBreakdown({ bySource }: { bySource: Record<string, number> }) {
  const entries = Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = entries[0]?.[1] ?? 0;
  if (entries.length === 0) return null;

  return (
    <div className="nx-surface p-5">
      <h3 className="text-[13px] font-semibold tracking-tight">Systems by source</h3>
      <div className="mt-4 space-y-2.5">
        {entries.map(([source, count]) => {
          const pct = max > 0 ? (count / max) * 100 : 0;
          return (
            <div key={source} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="capitalize text-foreground">{source}</span>
                <span className="nx-tabular text-muted-foreground">{count}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Insights — actionable recommendations
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
    insights.push({ severity: "critical", title: `${critical} critical-risk system${critical === 1 ? "" : "s"} need review`, description: "Highest governance risk — unmonitored, unowned, or using sensitive data.", href: "/platform/assets?risk=critical", action: "Review now" });
  }
  if (analytics.orphanedAssets > 0) {
    insights.push({ severity: "warning", title: `${analytics.orphanedAssets} system${analytics.orphanedAssets === 1 ? "" : "s"} with no owner`, description: "Assign an owner so someone is accountable.", href: "/platform/assets?owner=orphaned", action: "Assign owners" });
  }
  if (analytics.openViolations > 0) {
    insights.push({ severity: "warning", title: `${analytics.openViolations} open policy violation${analytics.openViolations === 1 ? "" : "s"}`, description: "These systems breach your governance policies.", href: "/platform/policies", action: "View violations" });
  }
  if (high > 0 && critical === 0) {
    insights.push({ severity: "warning", title: `${high} high-risk system${high === 1 ? "" : "s"} detected`, description: "Review for proper governance and ownership.", href: "/platform/assets?risk=high", action: "Review" });
  }
  if (analytics.connectorCount === 1) {
    insights.push({ severity: "info", title: "Only 1 source connected", description: "Connect more sources to expand visibility.", href: "/platform/connectors", action: "Add source" });
  }
  if (insights.length === 0) {
    insights.push({ severity: "success", title: "No urgent issues", description: "All systems owned, no violations, risk under control.", href: "/platform/assets", action: "View systems" });
  }
  return insights.slice(0, 4);
}

const insightStyles = {
  critical: { border: "border-destructive/30", bg: "bg-destructive/5", dot: "bg-destructive", text: "text-destructive" },
  warning:  { border: "border-warning/30", bg: "bg-warning/5", dot: "bg-warning", text: "text-warning" },
  info:     { border: "border-primary/30", bg: "bg-primary/5", dot: "bg-primary", text: "text-primary" },
  success:  { border: "border-success/30", bg: "bg-success/5", dot: "bg-success", text: "text-success" },
} as const;

function InsightsPanel({ analytics }: { analytics: AnalyticsData }) {
  const insights = generateInsights(analytics);
  return (
    <div className="space-y-3">
      <h3 className="text-[13px] font-semibold tracking-tight">What you should do next</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {insights.map((insight, i) => {
          const s = insightStyles[insight.severity];
          return (
            <Link key={i} href={insight.href} className={cn("nx-surface flex flex-col gap-2 p-4 transition-colors hover:border-border-strong", s.border, s.bg)}>
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full shrink-0", s.dot)} />
                <span className="text-[13px] font-semibold text-foreground leading-snug">{insight.title}</span>
              </div>
              <p className="text-[12px] leading-relaxed text-muted-foreground">{insight.description}</p>
              <span className={cn("text-[12px] font-medium mt-auto", s.text)}>{insight.action} →</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Empty state
// --------------------------------------------------------------------------

function EmptyDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Control Plane</h1>
        <p className="mt-1 text-sm text-muted-foreground">Connect a source to start discovering AI systems across your organization.</p>
      </div>
      <div className="nx-surface flex flex-col items-center gap-4 px-6 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-xl border border-border bg-muted/40">
          <Plug className="size-6 text-muted-foreground/70" aria-hidden />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Connect your first source</h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Link GitHub, GitLab, AWS, or an automation platform. Spekris will automatically scan for AI agents, LLM integrations, and ML workflows, then score risk and surface what needs attention.
        </p>
        <Link href="/platform/connectors" className={buttonVariants({ size: "lg" })}>
          Add connector <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Clean scan
// --------------------------------------------------------------------------

function CleanScanDashboard({ analytics }: { analytics: AnalyticsData }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Control Plane</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitoring {analytics.connectorCount} connected source{analytics.connectorCount === 1 ? "" : "s"}.
        </p>
      </div>
      <div className="nx-surface flex flex-col items-center gap-5 px-6 py-14 text-center">
        <div className="flex size-14 items-center justify-center rounded-full border border-success/20 bg-success/10">
          <ShieldCheck className="size-7 text-success" aria-hidden />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">You&apos;re in control — no risky AI systems detected</h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Spekris scanned your connected sources and found no operational AI systems that need governance attention.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 text-[12px] text-muted-foreground">
          <span>Scans run automatically to detect changes.</span>
          <span>Connect more sources to expand coverage.</span>
        </div>
        <Link href="/platform/connectors" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Manage sources <ArrowRight className="size-3.5" />
        </Link>
      </div>
      {analytics.recentEvents.length > 0 && <WhatsHappening events={analytics.recentEvents} />}
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
  if (!analytics || analytics.connectorCount === 0) return <EmptyDashboard />;
  if (analytics.totalAssets === 0) return <CleanScanDashboard analytics={analytics} />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Control Plane</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {analytics.totalAssets} AI system{analytics.totalAssets === 1 ? "" : "s"} across {analytics.connectorCount} source{analytics.connectorCount === 1 ? "" : "s"}
          {analytics.lastSyncAt && <> · Last scan {formatRelative(analytics.lastSyncAt)}</>}
        </p>
      </div>

      {/* Key metrics — 2x2 grid that works on mobile */}
      <SignalCards analytics={analytics} />

      {/* What you should do — most important for decision-making */}
      <InsightsPanel analytics={analytics} />

      {/* Highest risk systems — actionable */}
      <HighestRiskSystems assets={analytics.topRiskAssets} />

      {/* Ownership + compliance side by side on desktop, stacked on mobile */}
      <div className="grid gap-4 sm:grid-cols-2">
        <OwnershipCoverage analytics={analytics} />
        {analytics.complianceScore !== null && (
          <Link href="/platform/compliance" className="nx-surface flex items-center gap-4 p-5 transition-colors hover:border-border-strong">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold tracking-tight">Compliance Score</h3>
                <span className={cn("text-lg font-bold nx-tabular", analytics.complianceScore >= 70 ? "text-success" : analytics.complianceScore >= 40 ? "text-warning" : "text-destructive")}>{analytics.complianceScore}%</span>
              </div>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", analytics.complianceScore >= 70 ? "bg-success" : analytics.complianceScore >= 40 ? "bg-warning" : "bg-destructive")} style={{ width: `${analytics.complianceScore}%` }} />
              </div>
              <p className="mt-2 text-[12px] text-muted-foreground">
                Across 4 frameworks. <span className="font-medium text-foreground">View details →</span>
              </p>
            </div>
          </Link>
        )}
      </div>

      {/* Activity feed */}
      <WhatsHappening events={analytics.recentEvents} />
    </div>
  );
}
