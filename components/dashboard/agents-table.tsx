"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Agent } from "@/lib/types";
import { AlertTriangle, ShieldAlert, Shield, Info, ExternalLink } from "lucide-react";

// ─── RISK CONFIG ─────────────────────────────────────────────────────────
const RISK_CONFIG: Record<string, {
  rowClass: string;
  badgeClass: string;
  icon: React.ReactNode;
  label: string;
}> = {
  critical: {
    rowClass: "bg-red-50/50 hover:bg-red-50",
    badgeClass: "bg-red-100 text-red-800 border-red-300 font-semibold",
    icon: <ShieldAlert className="h-3.5 w-3.5 text-red-600" />,
    label: "CRITICAL",
  },
  high: {
    rowClass: "bg-orange-50/30 hover:bg-orange-50",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-300 font-semibold",
    icon: <AlertTriangle className="h-3.5 w-3.5 text-orange-600" />,
    label: "HIGH",
  },
  medium: {
    rowClass: "hover:bg-muted/30",
    badgeClass: "bg-yellow-50 text-yellow-800 border-yellow-300",
    icon: <Shield className="h-3.5 w-3.5 text-yellow-600" />,
    label: "MEDIUM",
  },
  low: {
    rowClass: "hover:bg-muted/20",
    badgeClass: "bg-green-50 text-green-800 border-green-300",
    icon: <Info className="h-3.5 w-3.5 text-green-600" />,
    label: "LOW",
  },
};

// ─── COMPLIANCE TAG COLORS ────────────────────────────────────────────────
const COMPLIANCE_COLORS: Record<string, string> = {
  HIPAA: "bg-red-50 text-red-700 border-red-200",
  SOC2: "bg-blue-50 text-blue-700 border-blue-200",
  EU_AI_ACT: "bg-purple-50 text-purple-700 border-purple-200",
  ISO42001: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

// ─── CONFIDENCE BAR ───────────────────────────────────────────────────────
function ConfidenceBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.round(score);
  const color =
    pct >= 80 ? "bg-emerald-500" :
    pct >= 60 ? "bg-yellow-400" :
    "bg-muted-foreground/40";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
    </div>
  );
}

// ─── OWNER CELL ───────────────────────────────────────────────────────────
function OwnerCell({ agent }: { agent: Agent }) {
  if (!agent.owner_github && !agent.owner_email) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
        <span className="text-sm font-medium text-red-700">No owner</span>
      </div>
    );
  }

  const isStale = agent.days_since_commit != null && agent.days_since_commit > 90;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        <div className={`h-2 w-2 rounded-full shrink-0 ${isStale ? "bg-orange-400" : "bg-emerald-400"}`} />
        <span className={`text-sm ${isStale ? "text-orange-700" : ""}`}>
          {agent.owner_github ?? "—"}
        </span>
      </div>
      {agent.owner_email && (
        <div className="text-xs text-muted-foreground">{agent.owner_email}</div>
      )}
    </div>
  );
}

// ─── STALENESS CELL ──────────────────────────────────────────────────────
function StaleCell({ days }: { days: number | null }) {
  if (days == null) return <span className="text-muted-foreground text-sm">Unknown</span>;
  if (days > 180) return <span className="text-red-700 font-semibold text-sm">{days}d ⚠</span>;
  if (days > 90)  return <span className="text-orange-600 font-medium text-sm">{days}d</span>;
  if (days > 30)  return <span className="text-yellow-600 text-sm">{days}d</span>;
  return <span className="text-muted-foreground text-sm">{days}d</span>;
}

// ─── SUMMARY STATS ────────────────────────────────────────────────────────
function ScanSummary({ agents }: { agents: Agent[] }) {
  const critical = agents.filter(a => a.risk_level === "critical").length;
  const high = agents.filter(a => a.risk_level === "high").length;
  const noOwner = agents.filter(a => !a.owner_github && !a.owner_email).length;
  const withSecrets = agents.filter(a => a.has_secrets).length;
  const withPhi = agents.filter(a => (a.compliance_tags ?? []).includes("HIPAA")).length;

  return (
    <div className="flex flex-wrap gap-3 px-1 pb-1">
      {critical > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" />
          <span className="text-sm font-semibold text-red-800">{critical} critical</span>
        </div>
      )}
      {high > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />
          <span className="text-sm font-medium text-orange-800">{high} high risk</span>
        </div>
      )}
      {noOwner > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2">
          <div className="h-4 w-4 flex items-center justify-center">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
          </div>
          <span className="text-sm font-medium text-red-700">{noOwner} unowned</span>
        </div>
      )}
      {withSecrets > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-100 px-3 py-2">
          <span className="text-sm font-bold text-red-800">🔑 {withSecrets} with secrets</span>
        </div>
      )}
      {withPhi > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <span className="text-sm font-medium text-red-700">⚕ {withPhi} HIPAA exposure</span>
        </div>
      )}
    </div>
  );
}

// ─── MAIN TABLE ───────────────────────────────────────────────────────────
export function AgentsTable({ agents }: { agents: Agent[] }) {
  // Sort: critical first, then by confidence desc
  const sorted = [...agents].sort((a, b) => {
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const rDiff = (riskOrder[a.risk_level] ?? 9) - (riskOrder[b.risk_level] ?? 9);
    if (rDiff !== 0) return rDiff;
    return (b.confidence_score ?? 0) - (a.confidence_score ?? 0);
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-3">
        <div>
          <CardTitle>AI Assets Found</CardTitle>
          <CardDescription>
            {agents.length} AI {agents.length === 1 ? "asset" : "assets"} detected across your organization
          </CardDescription>
        </div>
        <ScanSummary agents={agents} />
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[240px]">Asset</TableHead>
                <TableHead className="w-[160px]">Repository</TableHead>
                <TableHead className="w-[140px]">Owner</TableHead>
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead className="w-[90px]">Risk</TableHead>
                <TableHead className="w-[220px]">Why This Matters</TableHead>
                <TableHead className="w-[70px]">Stale</TableHead>
                <TableHead className="w-[90px]">Confidence</TableHead>
                <TableHead className="w-[130px]">Compliance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((agent) => {
                const rc = RISK_CONFIG[agent.risk_level] ?? RISK_CONFIG.medium;
                const ghUrl = `https://github.com/${agent.repo}/blob/HEAD/${agent.file_path}`;
                return (
                  <TableRow key={agent.id} className={rc.rowClass}>
                    {/* Asset name + file path */}
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm leading-tight">{agent.name}</span>
                          <a
                            href={ghUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground shrink-0"
                            title="View on GitHub"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate max-w-[220px]" title={agent.file_path}>
                          {agent.file_path}
                        </div>
                        {agent.description && (
                          <div className="text-xs text-muted-foreground leading-snug mt-0.5">
                            {agent.description}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Repo */}
                    <TableCell>
                      <span className="text-xs font-mono text-muted-foreground">
                        {agent.repo.split("/")[1] ?? agent.repo}
                      </span>
                    </TableCell>

                    {/* Owner */}
                    <TableCell>
                      <OwnerCell agent={agent} />
                    </TableCell>

                    {/* Type badge */}
                    <TableCell>
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {agent.agent_type ?? "AI Agent"}
                      </Badge>
                    </TableCell>

                    {/* Risk badge */}
                    <TableCell>
                      <Badge className={`${rc.badgeClass} border flex items-center gap-1 w-fit`}>
                        {rc.icon}
                        {rc.label}
                      </Badge>
                    </TableCell>

                    {/* Why this matters — plain English */}
                    <TableCell>
                      <p className="text-xs leading-snug text-foreground/80 max-w-[210px]">
                        {agent.why_flagged ?? agent.risk_reason ?? "Review recommended."}
                      </p>
                      {agent.has_secrets && (
                        <Badge variant="destructive" className="text-xs mt-1">
                          🔑 Credentials exposed
                        </Badge>
                      )}
                    </TableCell>

                    {/* Staleness */}
                    <TableCell>
                      <StaleCell days={agent.days_since_commit} />
                    </TableCell>

                    {/* Confidence */}
                    <TableCell>
                      <ConfidenceBar score={agent.confidence_score} />
                    </TableCell>

                    {/* Compliance tags */}
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(agent.compliance_tags ?? []).map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className={`text-xs ${COMPLIANCE_COLORS[tag] ?? "bg-muted text-muted-foreground"}`}
                          >
                            {tag}
                          </Badge>
                        ))}
                        {(agent.compliance_tags ?? []).length === 0 && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
