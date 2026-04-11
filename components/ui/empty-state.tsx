import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
  /** Use "inline" inside tables/cards, "page" for full-screen empty states. */
  variant?: "page" | "inline";
}

/**
 * Universal empty state. No illustrations — just a clear message and a
 * single primary next step. Used for first-run, filtered-empty, and
 * post-completion states.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
  variant = "page",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        variant === "page" ? "py-16 px-6" : "py-10 px-4",
        className,
      )}
    >
      {Icon && (
        <div
          className={cn(
            "mb-4 flex items-center justify-center rounded-lg border border-border bg-muted/40",
            variant === "page" ? "size-12" : "size-10",
          )}
        >
          <Icon
            className={cn(
              "text-muted-foreground/70",
              variant === "page" ? "size-5" : "size-4",
            )}
            aria-hidden
          />
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-md text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
      {(primaryAction || secondaryAction) && (
        <div className="mt-5 flex items-center gap-2">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
