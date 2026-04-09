"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/types/platform";

// ---- Types ----

interface NotificationItem {
  id: string;
  title: string;
  body?: string | null;
  severity: Severity;
  readAt: string | null;
  createdAt: string;
}

interface NotificationDropdownProps {
  className?: string;
}

// ---- Helpers ----

const SEVERITY_DOT: Record<Severity, string> = {
  info: "bg-blue-500",
  low: "bg-emerald-500",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

function formatTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (diffMs < 0) return "now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ---- Component ----

export function NotificationDropdown({
  className,
}: NotificationDropdownProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      const items: NotificationItem[] = (data.data ?? data ?? []).map(
        (n: Record<string, unknown>) => ({
          id: n.id as string,
          title: n.title as string,
          body: (n.body as string) ?? null,
          severity: (n.severity as Severity) ?? "info",
          readAt: (n.read_at as string) ?? null,
          createdAt: (n.created_at as string) ?? new Date().toISOString(),
        })
      );
      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.readAt).length);
    } catch {
      // silently fail
    }
  }, []);

  // Initial fetch + polling every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  // Mark all read
  const markAllRead = useCallback(async () => {
    setLoading(true);
    try {
      await fetch("/api/notifications/read", { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          readAt: n.readAt ?? new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div ref={dropdownRef} className={cn("relative", className)}>
      {/* Bell trigger */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-medium">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                disabled={loading}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
              >
                <Check className="size-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
                <Bell className="mb-2 size-6 opacity-40" />
                <p>No notifications</p>
              </div>
            ) : (
              <ul className="flex flex-col">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50",
                      !n.readAt && "bg-primary/5"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        SEVERITY_DOT[n.severity],
                        n.readAt && "opacity-40"
                      )}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span
                        className={cn(
                          "text-sm leading-snug",
                          n.readAt
                            ? "text-muted-foreground"
                            : "font-medium text-foreground"
                        )}
                      >
                        {n.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(n.createdAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="border-t px-3 py-2 text-center">
            <a
              href="/notifications"
              className="text-xs text-primary hover:underline"
            >
              View all notifications
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
