"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, FacetDropdown } from "@/components/platform/filter-bar";
import { eventSeverityMeta } from "@/lib/design/status";
import { cn } from "@/lib/utils";
import type { Event } from "@/lib/types/platform";

const KIND_LABELS: Record<string, string> = {
  asset_discovered: "Asset discovered",
  asset_changed: "Asset changed",
  asset_quarantined: "Asset quarantined",
  owner_departed: "Owner departed",
  owner_orphaned: "Asset orphaned",
  owner_assigned: "Owner assigned",
  risk_increased: "Risk increased",
  policy_violated: "Policy violated",
  connector_sync_completed: "Sync completed",
  connector_sync_failed: "Sync failed",
  member_invited: "Member invited",
};

const SEVERITY_OPTIONS = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "info", label: "Info" },
];

const KIND_OPTIONS = Object.entries(KIND_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / 86400);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

function formatDayHeader(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function groupByDay(events: Event[]): Record<string, Event[]> {
  const groups: Record<string, Event[]> = {};
  for (const event of events) {
    const day = new Date(event.created_at).toDateString();
    (groups[day] ??= []).push(event);
  }
  return groups;
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<string[]>([]);
  const [kinds, setKinds] = useState<string[]>([]);
  const pageSize = 50;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      ...(severity.length && { severity: severity.join(",") }),
      ...(kinds.length && { kind: kinds.join(",") }),
    });
    try {
      const res = await fetch(`/api/events?${params}`);
      const data = await res.json();
      setEvents(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch {
      toast.error("Failed to load events. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [page, severity, kinds]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, severity, kinds]);

  async function markAllRead() {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      toast.success("All events marked as read");
    } catch {
      toast.error("Could not mark events as read");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Client-side filter by search (text only; server handles the rest)
  const visible = search
    ? events.filter(
        (e) =>
          e.title.toLowerCase().includes(search.toLowerCase()) ||
          e.body?.toLowerCase().includes(search.toLowerCase()),
      )
    : events;

  const grouped = groupByDay(visible);
  const dayKeys = Object.keys(grouped);

  const hasFilters = search.length > 0 || severity.length > 0 || kinds.length > 0;

  function clearAllFilters() {
    setSearch("");
    setSeverity([]);
    setKinds([]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        description="Unified feed of discoveries, ownership changes, policy violations, and connector activity."
        meta={
          <>
            <span className="nx-tabular">{total}</span>
            <span>total events</span>
          </>
        }
        secondaryActions={
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="size-3.5" />
            Mark all read
          </Button>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        facets={
          <>
            <FacetDropdown
              label="Severity"
              options={SEVERITY_OPTIONS}
              selected={severity}
              onChange={setSeverity}
            />
            <FacetDropdown
              label="Type"
              options={KIND_OPTIONS}
              selected={kinds}
              onChange={setKinds}
            />
          </>
        }
      />

      {/* Feed */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg border border-border bg-muted/30"
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="nx-surface">
          {hasFilters ? (
            <EmptyState
              icon={Bell}
              title="No events match your filters"
              description="Try adjusting your filters or clearing them to see everything."
              primaryAction={
                <Button variant="outline" size="sm" onClick={clearAllFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Bell}
              title="No events yet"
              description="Events appear here as Spekris discovers assets, runs policies, and observes ownership changes."
            />
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {dayKeys.map((day) => {
            const items = grouped[day];
            return (
              <section key={day} className="space-y-2">
                <div className="sticky top-14 z-10 -mx-2 flex items-center gap-3 bg-background/95 px-2 py-1 backdrop-blur">
                  <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {formatDayHeader(items[0].created_at)}
                  </h2>
                  <span className="text-[11px] text-muted-foreground/70 nx-tabular">
                    {items.length} {items.length === 1 ? "event" : "events"}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <ul className="nx-surface divide-y divide-border">
                  {items.map((event) => {
                    const meta = eventSeverityMeta(event.severity);
                    return (
                      <li
                        key={event.id}
                        className={cn(
                          "flex items-start gap-3 border-l-2 bg-card px-4 py-3",
                          meta.borderClass,
                        )}
                      >
                        <span
                          className={cn("mt-1.5 size-2 shrink-0 rounded-full", meta.dotClass)}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className="truncate text-[13px] font-medium text-foreground">
                              {event.title}
                            </p>
                            <time className="shrink-0 text-[11px] text-muted-foreground nx-tabular">
                              {timeAgo(event.created_at)}
                            </time>
                          </div>
                          {event.body && (
                            <p className="mt-0.5 text-[12px] text-muted-foreground line-clamp-2">
                              {event.body}
                            </p>
                          )}
                          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className={cn("font-medium capitalize", meta.textClass)}>
                              {meta.label}
                            </span>
                            <span>·</span>
                            <span>{KIND_LABELS[event.kind] ?? event.kind}</span>
                            {event.asset_id && event.asset && (
                              <>
                                <span>·</span>
                                <Link
                                  href={`/platform/assets/${event.asset_id}`}
                                  className="text-primary hover:underline"
                                >
                                  {event.asset.name}
                                </Link>
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
          <p className="nx-tabular">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="xs"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="size-3" />
              Previous
            </Button>
            <Button
              variant="ghost"
              size="xs"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
              <ChevronRight className="size-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
