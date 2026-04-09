import { Badge } from "@/components/ui/badge";
import type { RiskLevel } from "@/lib/types/platform";

interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
  className?: string;
}

const RISK_STYLES: Record<RiskLevel, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/20",
  high: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  low: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
};

const RISK_DOTS: Record<RiskLevel, string> = {
  critical: "bg-destructive",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-emerald-500",
};

export function RiskBadge({ level, score, className }: RiskBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold ${RISK_STYLES[level]} ${className ?? ""}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${RISK_DOTS[level]}`} />
      {level.toUpperCase()}
      {score !== undefined && <span className="opacity-70">({score})</span>}
    </span>
  );
}

export function OwnerStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active_owner: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    inactive_owner: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    orphaned: "bg-destructive/10 text-destructive border-destructive/20",
    unknown_owner: "bg-muted text-muted-foreground border-muted-foreground/20",
    reassignment_pending: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
    reviewed_unassigned: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  };

  const labels: Record<string, string> = {
    active_owner: "Active Owner",
    inactive_owner: "Owner Departed",
    orphaned: "Orphaned",
    unknown_owner: "Unknown Owner",
    reassignment_pending: "Reassignment Pending",
    reviewed_unassigned: "Reviewed — Unassigned",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${styles[status] ?? styles.unknown_owner}`}>
      {labels[status] ?? status}
    </span>
  );
}
