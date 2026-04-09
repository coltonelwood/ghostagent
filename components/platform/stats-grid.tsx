import { ArrowUp, ArrowDown, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatItem {
  label: string;
  value: string | number;
  change?: number;
  icon?: LucideIcon;
  color?: string;
}

interface StatsGridProps {
  stats: StatItem[];
  className?: string;
}

export function StatsGrid({ stats, className }: StatsGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 lg:grid-cols-4",
        className
      )}
    >
      {stats.map((stat) => {
        const Icon = stat.icon;
        const isPositive = stat.change != null && stat.change > 0;
        const isNegative = stat.change != null && stat.change < 0;

        return (
          <Card key={stat.label} size="sm">
            <CardContent className="flex items-start gap-3">
              {Icon && (
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    stat.color ?? "bg-primary/10 text-primary"
                  )}
                >
                  <Icon className="size-4" />
                </span>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-xs text-muted-foreground truncate">
                  {stat.label}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums text-foreground leading-none">
                    {typeof stat.value === "number"
                      ? stat.value.toLocaleString()
                      : stat.value}
                  </span>
                  {stat.change != null && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 text-xs font-medium",
                        isPositive && "text-emerald-600 dark:text-emerald-400",
                        isNegative && "text-red-600 dark:text-red-400",
                        !isPositive && !isNegative && "text-muted-foreground"
                      )}
                    >
                      {isPositive && <ArrowUp className="size-3" />}
                      {isNegative && <ArrowDown className="size-3" />}
                      {Math.abs(stat.change).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
