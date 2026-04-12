"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Shield, AlertTriangle, Users, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";

interface ConsumerStats {
  threats_reported: number;
  threats_blocked: number;
  people_protected: number;
  protection_score: number;
  active_alerts: number;
}

interface Alert {
  id: string;
  alert_type: string;
  title: string;
  body: string | null;
  severity: string;
  read_at: string | null;
  created_at: string;
}

const SEVERITY_VARIANT: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
  info: "outline",
};

export function ConsumerDashboard() {
  const [stats, setStats] = useState<ConsumerStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, alertsRes] = await Promise.all([
          fetch("/api/consumer/stats"),
          fetch("/api/consumer/alerts?limit=10"),
        ]);
        if (statsRes.ok) setStats(await statsRes.json());
        if (alertsRes.ok) {
          const data = await alertsRes.json();
          setAlerts(data.data ?? []);
        }
      } catch {
        toast.error("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="nx-surface h-32 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Protection Score Hero */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="flex flex-col items-center gap-4 py-8 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <p className="text-sm font-medium text-muted-foreground">Your Protection Score</p>
            <p className="text-5xl font-bold text-primary">
              {stats?.protection_score ?? 0}
              <span className="text-2xl text-muted-foreground">/100</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {(stats?.protection_score ?? 0) >= 70
                ? "You're well protected. Keep reporting threats!"
                : "Report more threats to increase your protection."}
            </p>
          </div>
          <Link href="/report">
            <Button size="lg">
              <Send className="size-4" />
              Report a threat
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Threats Reported"
          value={stats?.threats_reported ?? 0}
          icon={AlertTriangle}
          description="Your total reports"
        />
        <StatCard
          label="Threats Blocked"
          value={stats?.threats_blocked ?? 0}
          icon={Shield}
          tone={stats?.threats_blocked ? "success" : "neutral"}
          description="Attacks prevented for you"
        />
        <StatCard
          label="People Protected"
          value={stats?.people_protected ?? 0}
          icon={Users}
          tone="success"
          description="By your reports"
        />
        <StatCard
          label="Active Alerts"
          value={stats?.active_alerts ?? 0}
          icon={AlertTriangle}
          tone={stats?.active_alerts ? "warning" : "neutral"}
          description="Threats targeting your profile"
        />
      </div>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No alerts yet. As threats are detected that match your profile, they'll appear here.
            </p>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                    alert.read_at ? "border-border" : "border-primary/30 bg-primary/5"
                  }`}
                >
                  <AlertTriangle className={`mt-0.5 size-4 shrink-0 ${
                    alert.severity === "critical" || alert.severity === "high"
                      ? "text-destructive"
                      : "text-warning"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <Badge variant={SEVERITY_VARIANT[alert.severity] ?? "secondary"}>
                        {alert.severity}
                      </Badge>
                    </div>
                    {alert.body && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{alert.body}</p>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatRelative(alert.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
