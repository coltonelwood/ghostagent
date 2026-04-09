"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/lib/types/platform";

interface AssetRiskBadgeProps {
  level: RiskLevel;
  score?: number;
  size?: "sm" | "md";
  className?: string;
}

const LEVEL_STYLES: Record<RiskLevel, string> = {
  low: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  medium: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:text-yellow-400",
  high: "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400",
  critical:
    "bg-destructive/10 text-destructive border-destructive/20 dark:text-red-400",
};

const DOT_STYLES: Record<RiskLevel, string> = {
  low: "bg-emerald-500",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  critical: "bg-destructive",
};

export function AssetRiskBadge({
  level,
  score,
  size = "md",
  className,
}: AssetRiskBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        LEVEL_STYLES[level],
        size === "sm" ? "h-4 px-1.5 text-[10px]" : "h-5 px-2 text-xs",
        className
      )}
    >
      <span
        className={cn(
          "shrink-0 rounded-full",
          DOT_STYLES[level],
          size === "sm" ? "size-1.5" : "size-2"
        )}
      />
      {level.toUpperCase()}
      {score !== undefined && (
        <span className="opacity-70">({score})</span>
      )}
    </Badge>
  );
}
