"use client";

import { cn } from "@/lib/utils";

interface ComplianceGaugeProps {
  score: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: { width: 80, stroke: 6, fontSize: "text-lg", labelSize: "text-[10px]" },
  md: { width: 120, stroke: 8, fontSize: "text-2xl", labelSize: "text-xs" },
  lg: { width: 160, stroke: 10, fontSize: "text-3xl", labelSize: "text-sm" },
} as const;

function getColor(score: number): {
  stroke: string;
  text: string;
  track: string;
} {
  if (score >= 80) {
    return {
      stroke: "stroke-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
      track: "stroke-emerald-500/15",
    };
  }
  if (score >= 50) {
    return {
      stroke: "stroke-yellow-500",
      text: "text-yellow-600 dark:text-yellow-400",
      track: "stroke-yellow-500/15",
    };
  }
  return {
    stroke: "stroke-red-500",
    text: "text-red-600 dark:text-red-400",
    track: "stroke-red-500/15",
  };
}

export function ComplianceGauge({
  score,
  label,
  size = "md",
  className,
}: ComplianceGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const config = SIZE_MAP[size];
  const radius = (config.width - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75; // 270-degree arc
  const offset = arcLength - (arcLength * clamped) / 100;
  const colors = getColor(clamped);

  return (
    <div
      className={cn(
        "relative inline-flex flex-col items-center",
        className
      )}
      style={{ width: config.width, height: config.width }}
    >
      <svg
        width={config.width}
        height={config.width}
        viewBox={`0 0 ${config.width} ${config.width}`}
        className="-rotate-[135deg]"
      >
        {/* Track */}
        <circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={radius}
          fill="none"
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          className={colors.track}
        />
        {/* Indicator */}
        <circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={radius}
          fill="none"
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={offset}
          className={cn(colors.stroke, "transition-all duration-700 ease-out")}
        />
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn("font-bold tabular-nums leading-none", config.fontSize, colors.text)}
        >
          {clamped}
          <span className={cn("font-medium", config.labelSize)}>%</span>
        </span>
        {label && (
          <span
            className={cn(
              "mt-1 text-muted-foreground leading-none",
              config.labelSize
            )}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
