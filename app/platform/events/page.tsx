"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Bell, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Event } from "@/lib/types/platform";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "text-destructive",
  high: "text-orange-500",
  medium: "text-yellow-500",
  low: "text-blue-500",
  info: "text-muted-foreground",
};

const SEVERITY_ICONS: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🔵",
  info: "⚪",
};

const KIND_LABELS: Record<string, string> = {
  asset_discovered: "Asset Discovered",
  asset_changed: "Asset Changed",
  asset_quarantined: "Asset Quarantined",
  owner_departed: "Owner Departed",
  owner_orphaned: "Asset Orphaned",
  owner_assigned: "Owner Assigned",
  risk_increased: "Risk Increased",
  policy_violated: "Policy Violated",
  connector_sync_completed: "Sync Completed",
  connector_sync_failed: "Sync Failed",
  member_invited: "Member Invited",
};

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState("");
  const [kind, setKind] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const pageSize = 50;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      ...(severity && { severity }),
      ...(kind && { kind }),
      ...(dateFrom && { from: dateFrom }),
      ...(dateTo && { to: dateTo }),
    });
    const res = await fetch(`/api/events?${params}`);
    const data = await res.json();
    setEvents(data.data ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, severity, kind, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-muted-foreground mt-1">{total} events in your organization</p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await fetch("/api/notifications/read", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ all: true }),
            });
          }}
        >
          Mark all read
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <select
            className="px-3 py-2 rounded-lg border text-sm bg-background"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All event types</option>
            {Object.entries(KIND_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            className="px-3 py-2 rounded-lg border text-sm bg-background"
            value={severity}
            onChange={(e) => {
              setSeverity(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All severities</option>
            {["critical", "high", "medium", "low", "info"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="h-9 w-36 text-sm"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="h-9 w-36 text-sm"
          />
        </div>

        {(severity || kind || dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSeverity("");
              setKind("");
              setDateFrom("");
              setDateTo("");
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Event list */}
      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-16">
              <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="font-medium">No events found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {severity || kind || dateFrom || dateTo
                  ? "Try adjusting your filters."
                  : "Events will appear here as Nexus discovers and monitors your AI assets."}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="text-lg leading-none mt-0.5 shrink-0">
                    {SEVERITY_ICONS[event.severity] ?? "⚪"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${SEVERITY_STYLES[event.severity] ?? ""}`}>
                        {event.title}
                      </p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {timeAgo(event.created_at)}
                      </span>
                    </div>
                    {event.body && (
                      <p className="text-xs text-muted-foreground mt-0.5">{event.body}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="outline" className="text-xs">
                        {KIND_LABELS[event.kind] ?? event.kind}
                      </Badge>
                      {event.asset_id && event.asset && (
                        <Link
                          href={`/platform/assets/${event.asset_id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          {event.asset.name}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
