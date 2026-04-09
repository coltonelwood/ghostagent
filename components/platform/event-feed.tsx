"use client";

import { useCallback } from "react";
import {
  Info,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Flame,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/types/platform";

interface EventFeedItem {
  id: string;
  severity: Severity;
  title: string;
  createdAt: string;
  assetId?: string | null;
  assetName?: string | null;
}

interface EventFeedProps {
  events: EventFeedItem[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  className?: string;
}

const SEVERITY_CONFIG: Record<
  Severity,
  { icon: typeof Info; color: string; dot: string }
> = {
  info: {
    icon: Info,
    color: "text-blue-500",
    dot: "bg-blue-500",
  },
  low: {
    icon: ShieldCheck,
    color: "text-emerald-500",
    dot: "bg-emerald-500",
  },
  medium: {
    icon: AlertTriangle,
    color: "text-yellow-500",
    dot: "bg-yellow-500",
  },
  high: {
    icon: AlertOctagon,
    color: "text-orange-500",
    dot: "bg-orange-500",
  },
  critical: {
    icon: Flame,
    color: "text-red-500",
    dot: "bg-red-500",
  },
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return "just now";
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function EventFeed({
  events,
  onLoadMore,
  hasMore = false,
  className,
}: EventFeedProps) {
  const handleLoadMore = useCallback(() => {
    onLoadMore?.();
  }, [onLoadMore]);

  if (events.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-8 text-sm text-muted-foreground",
          className
        )}
      >
        <Info className="mb-2 size-8 opacity-40" />
        <p>No events yet</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <ul className="flex flex-col divide-y divide-border">
        {events.map((event) => {
          const config = SEVERITY_CONFIG[event.severity];
          const Icon = config.icon;
          return (
            <li key={event.id} className="flex items-start gap-3 py-3 first:pt-0">
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                  config.color,
                  "bg-current/10"
                )}
              >
                <Icon className={cn("size-3.5", config.color)} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground leading-snug">
                  {event.title}
                </span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatRelativeTime(event.createdAt)}</span>
                  {event.assetId && event.assetName && (
                    <>
                      <span className="text-border">|</span>
                      <a
                        href={`/assets/${event.assetId}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {event.assetName}
                        <ExternalLink className="size-3" />
                      </a>
                    </>
                  )}
                </div>
              </div>
              <span
                className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", config.dot)}
              />
            </li>
          );
        })}
      </ul>
      {hasMore && (
        <div className="flex justify-center pt-3">
          <Button variant="outline" size="sm" onClick={handleLoadMore}>
            Show more
          </Button>
        </div>
      )}
    </div>
  );
}
