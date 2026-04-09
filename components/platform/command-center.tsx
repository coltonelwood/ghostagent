"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  AlertTriangle,
  UserX,
  ShieldAlert,
  Activity,
  Plug,
} from "lucide-react";

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

const RISK_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

const SEVERITY_VARIANT: Record<string, "destructive" | "secondary" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

function StatsGrid({ analytics }: { analytics: AnalyticsData }) {
  const stats = [
    {
      label: "Total Assets",
      value: analytics.totalAssets,
      icon: Database,
      description: "Active AI assets",
    },
    {
      label: "Critical / High Risk",
      value: `${analytics.criticalAssets} / ${analytics.assetsByRiskLevel.high ?? 0}`,
      icon: AlertTriangle,
      description: "Require attention",
    },
    {
      label: "Orphaned Assets",
      value: analytics.orphanedAssets,
      icon: UserX,
      description: "No active owner",
    },
    {
      label: "Open Violations",
      value: analytics.openViolations,
      icon: ShieldAlert,
      description: "Policy violations",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </span>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RiskDistribution({ assetsByRiskLevel }: { assetsByRiskLevel: Record<string, number> }) {
  const total = Object.values(assetsByRiskLevel).reduce((s, v) => s + v, 0);
  const levels = ["critical", "high", "medium", "low"] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {levels.map((level) => {
          const count = assetsByRiskLevel[level] ?? 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={level} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="capitalize">{level}</span>
                <span className="font-medium">
                  {count} ({pct.toFixed(0)}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${RISK_COLORS[level]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function EventFeed({
  events,
}: {
  events: AnalyticsData["recentEvents"];
}) {
  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No events yet. Events will appear here as connectors sync and
            policies are evaluated.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Events</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-3 rounded-lg border p-3"
            >
              <Activity className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{event.title}</span>
                  <Badge
                    variant={SEVERITY_VARIANT[event.severity] ?? "outline"}
                  >
                    {event.severity}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(event.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectorHealth({
  connectorsByStatus,
  connectorCount,
}: {
  connectorsByStatus: Record<string, number>;
  connectorCount: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connector Health</CardTitle>
      </CardHeader>
      <CardContent>
        {connectorCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            No connectors configured yet. Add your first connector to start
            discovering AI assets.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(connectorsByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center gap-2 rounded-lg border p-3">
                <Plug className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium capitalize">{status}</p>
                  <p className="text-lg font-bold">{count}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CommandCenterDashboard({
  analytics,
}: {
  analytics: AnalyticsData | null;
}) {
  if (!analytics) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
          <p className="text-muted-foreground">
            Welcome to Nexus. Connect your first data source to start
            discovering AI assets.
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Database className="mx-auto size-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No data yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Head to{" "}
              <a
                href="/platform/connectors"
                className="text-primary underline underline-offset-4"
              >
                Connectors
              </a>{" "}
              to connect your first data source.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
        <p className="text-muted-foreground">
          Real-time overview of your AI asset landscape.
        </p>
      </div>

      <StatsGrid analytics={analytics} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <RiskDistribution
            assetsByRiskLevel={analytics.assetsByRiskLevel}
          />
          {/* Top critical assets placeholder — rendered from same analytics data */}
          <Card>
            <CardHeader>
              <CardTitle>Top Critical Assets</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.criticalAssets === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No critical assets. Great job!
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {analytics.criticalAssets} critical asset
                  {analytics.criticalAssets !== 1 ? "s" : ""} detected.{" "}
                  <a
                    href="/platform/assets?risk_level=critical"
                    className="text-primary underline underline-offset-4"
                  >
                    View all
                  </a>
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <EventFeed events={analytics.recentEvents} />
          <ConnectorHealth
            connectorsByStatus={analytics.connectorsByStatus}
            connectorCount={analytics.connectorCount}
          />
        </div>
      </div>

      {/* Policy violations summary */}
      {analytics.openViolations > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Policy Violations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <span className="font-bold text-destructive">
                {analytics.openViolations}
              </span>{" "}
              open violation{analytics.openViolations !== 1 ? "s" : ""}{" "}
              require attention.{" "}
              <a
                href="/platform/policies"
                className="text-primary underline underline-offset-4"
              >
                Review policies
              </a>
            </p>
          </CardContent>
        </Card>
      )}

      {analytics.complianceScore !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Compliance Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <span className="text-3xl font-bold">
                {analytics.complianceScore}%
              </span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${analytics.complianceScore}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
