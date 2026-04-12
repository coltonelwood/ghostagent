"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ShieldAlert,
  Share2,
  Bell,
  Dna,
  RefreshCw,
  Plus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface Threat {
  id: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;
  status: string;
  detected_at: string;
  indicators?: string[];
  fingerprint?: string;
}

interface GenomeData {
  health_score: number;
  last_updated: string;
  fingerprints: Threat[];
}

interface ThreatStats {
  active_threats: number;
  shared_this_month: number;
  network_alerts: number;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const severityVariant = (
  severity: string,
): "default" | "destructive" | "secondary" | "outline" => {
  switch (severity) {
    case "critical":
      return "destructive";
    case "high":
      return "destructive";
    case "medium":
      return "secondary";
    default:
      return "outline";
  }
};

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

export function ThreatDashboard() {
  const [threats, setThreats] = useState<Threat[]>([]);
  const [stats, setStats] = useState<ThreatStats | null>(null);
  const [genome, setGenome] = useState<GenomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [threatsRes, genomeRes] = await Promise.all([
        fetch("/api/threats"),
        fetch("/api/threats/genome"),
      ]);

      if (threatsRes.ok) {
        const json = await threatsRes.json();
        setThreats(json.data ?? []);
        setStats(json.stats ?? null);
      }

      if (genomeRes.ok) {
        const json = await genomeRes.json();
        setGenome(json.data ?? null);
      }
    } catch {
      toast.error("Failed to load threat data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function refreshGenome() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/threats/genome", { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        setGenome(json.data ?? null);
        toast.success("Behavioral genome refreshed");
      } else {
        toast.error("Failed to refresh genome");
      }
    } catch {
      toast.error("Failed to refresh genome");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-border bg-muted/30"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl border border-border bg-muted/30" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Threats"
          value={stats?.active_threats ?? threats.length}
          icon={ShieldAlert}
          tone={
            (stats?.active_threats ?? threats.length) > 0 ? "danger" : "neutral"
          }
        />
        <StatCard
          label="Shared This Month"
          value={stats?.shared_this_month ?? 0}
          icon={Share2}
        />
        <StatCard
          label="Network Alerts"
          value={stats?.network_alerts ?? 0}
          icon={Bell}
          tone={
            (stats?.network_alerts ?? 0) > 5 ? "warning" : "neutral"
          }
        />
        <StatCard
          label="Genome Health"
          value={genome?.health_score != null ? `${genome.health_score}%` : "--"}
          icon={Dna}
          tone={
            genome?.health_score != null && genome.health_score < 70
              ? "warning"
              : "success"
          }
          description={
            genome?.last_updated
              ? `Updated ${timeAgo(genome.last_updated)}`
              : undefined
          }
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Link href="/platform/threats/report">
          <Button size="sm">
            <Plus className="size-3.5" />
            Report Threat
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshGenome}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Refresh Genome
        </Button>
      </div>

      {/* Threat fingerprints table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Behavioral Fingerprints</CardTitle>
          <CardDescription>
            Threat signatures detected and analyzed by the behavioral genome
            engine.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {threats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShieldAlert className="size-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No threats detected
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Your environment looks clean. Report a threat if you spot
                something suspicious.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground pl-4">
                      Type
                    </TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Severity
                    </TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Confidence
                    </TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground pr-4">
                      Detected
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {threats.map((threat) => (
                    <TableRow key={threat.id} className="h-12 hover:bg-muted/40">
                      <TableCell className="pl-4 text-[13px] font-medium">
                        {threat.type}
                      </TableCell>
                      <TableCell>
                        <Badge variant={severityVariant(threat.severity)}>
                          {threat.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[13px] nx-tabular">
                        {threat.confidence}%
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            threat.status === "active"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {threat.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-4 text-[12px] text-muted-foreground nx-tabular">
                        {timeAgo(threat.detected_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
