import Link from "next/link";
import { ArrowDown, ArrowUp, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  description?: string;
  icon?: LucideIcon;
  /**
   * Delta relative to the previous period. Positive is not inherently good —
   * use `invertDelta` when more is worse (e.g., critical findings).
   */
  delta?: {
    value: number;
    label?: string;
  };
  invertDelta?: boolean;
  /** Tone shifts the value color when it's worth drawing attention. */
  tone?: "neutral" | "danger" | "warning" | "success";
  href?: string;
  className?: string;
}

const toneClass: Record<NonNullable<StatCardProps["tone"]>, string> = {
  neutral: "text-foreground",
  danger: "text-destructive",
  warning: "text-warning",
  success: "text-success",
};

export function StatCard({
  label,
  value,
  description,
  icon: Icon,
  delta,
  invertDelta,
  tone = "neutral",
  href,
  className,
}: StatCardProps) {
  const body = (
    <div
      className={cn(
        "nx-surface group flex h-full flex-col gap-3 p-5 transition-colors",
        href && "hover:border-border-strong cursor-pointer",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {Icon && <Icon className="size-4 text-muted-foreground/70" aria-hidden />}
      </div>

      <div className={cn("text-[1.75rem] nx-tabular font-semibold leading-none", toneClass[tone])}>
        {value}
      </div>

      {(description || delta) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {delta && <DeltaBadge delta={delta} invert={invertDelta} />}
          {description && <span className="truncate">{description}</span>}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {body}
      </Link>
    );
  }
  return body;
}

function DeltaBadge({
  delta,
  invert,
}: {
  delta: NonNullable<StatCardProps["delta"]>;
  invert?: boolean;
}) {
  if (delta.value === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 font-medium">
        <Minus className="size-3" />
        {delta.label ?? "No change"}
      </span>
    );
  }

  const positive = delta.value > 0;
  const isGood = invert ? !positive : positive;
  const tone = isGood
    ? "bg-success/10 text-success"
    : "bg-destructive/10 text-destructive";
  const Icon = positive ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-medium",
        tone,
      )}
    >
      <Icon className="size-3" />
      {Math.abs(delta.value)}
      {delta.label && <span className="text-muted-foreground">{delta.label}</span>}
    </span>
  );
}
