import { cn } from "@/lib/utils";
import { riskVariant } from "@/lib/design/risk";

export interface RiskBadgeProps {
  level: string | null | undefined;
  score?: number | null;
  size?: "sm" | "md";
  showDot?: boolean;
  className?: string;
}

/**
 * Inline risk badge. Always use this — never hand-roll a pill.
 * Displays a colored dot + label + optional score.
 */
export function RiskBadge({
  level,
  score,
  size = "md",
  showDot = true,
  className,
}: RiskBadgeProps) {
  const variant = riskVariant(level);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border font-medium nx-tabular",
        variant.badgeClass,
        size === "sm"
          ? "h-5 px-1.5 text-[11px]"
          : "h-6 px-2 text-xs",
        className,
      )}
    >
      {showDot && (
        <span
          className={cn(
            "inline-block rounded-full",
            variant.dotClass,
            size === "sm" ? "size-1.5" : "size-2",
          )}
          aria-hidden
        />
      )}
      <span>{variant.label}</span>
      {typeof score === "number" && (
        <span className="text-[10px] opacity-70">· {Math.round(score)}</span>
      )}
    </span>
  );
}

export interface StatusDotProps {
  tone: "success" | "warning" | "danger" | "neutral" | "info";
  label?: string;
  className?: string;
}

const DOT_TONE: Record<StatusDotProps["tone"], string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
  neutral: "bg-muted-foreground",
};

/**
 * A simple dot + label status indicator — used in dense rows where a full
 * badge would be too noisy (owner, connector health, etc.).
 */
export function StatusDot({ tone, label, className }: StatusDotProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      <span
        className={cn("inline-block size-1.5 rounded-full", DOT_TONE[tone])}
        aria-hidden
      />
      {label && <span className="text-muted-foreground">{label}</span>}
    </span>
  );
}
