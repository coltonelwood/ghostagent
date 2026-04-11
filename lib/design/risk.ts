/**
 * Risk level → visual variant mapping. Single source of truth so every
 * table, card, and chart agrees on what "critical" looks like.
 */

export type RiskLevel = "critical" | "high" | "medium" | "low";

interface RiskVariant {
  label: string;
  /** Tailwind classes for a filled badge */
  badgeClass: string;
  /** Tailwind classes for a dot-only indicator */
  dotClass: string;
  /** Tailwind classes for a muted text color (for inline mentions) */
  textClass: string;
  /** Chart / gauge hex-ish token */
  tokenVar: string;
  /** Numeric weight for sorting (higher = worse) */
  weight: number;
}

export const RISK_VARIANTS: Record<RiskLevel, RiskVariant> = {
  critical: {
    label: "Critical",
    badgeClass:
      "border-destructive/20 bg-destructive/10 text-destructive dark:bg-destructive/15",
    dotClass: "bg-destructive",
    textClass: "text-destructive",
    tokenVar: "var(--destructive)",
    weight: 4,
  },
  high: {
    label: "High",
    badgeClass:
      "border-warning/30 bg-warning/15 text-warning-foreground dark:text-warning",
    dotClass: "bg-warning",
    textClass: "text-warning",
    tokenVar: "var(--warning)",
    weight: 3,
  },
  medium: {
    label: "Medium",
    badgeClass:
      "border-info/20 bg-info/10 text-info dark:bg-info/15 dark:text-info",
    dotClass: "bg-info",
    textClass: "text-info",
    tokenVar: "var(--info)",
    weight: 2,
  },
  low: {
    label: "Low",
    badgeClass:
      "border-success/20 bg-success/10 text-success dark:bg-success/15",
    dotClass: "bg-success",
    textClass: "text-success",
    tokenVar: "var(--success)",
    weight: 1,
  },
};

export function riskVariant(level: string | null | undefined): RiskVariant {
  if (!level) return RISK_VARIANTS.low;
  const key = level.toLowerCase() as RiskLevel;
  return RISK_VARIANTS[key] ?? RISK_VARIANTS.low;
}

/** Sort an array of items descending by risk level. */
export function byRiskDesc<T extends { risk_level?: string | null }>(
  rows: T[],
): T[] {
  return [...rows].sort(
    (a, b) => riskVariant(b.risk_level).weight - riskVariant(a.risk_level).weight,
  );
}
