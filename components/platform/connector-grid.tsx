"use client";

import { RefreshCw, Settings, Plug } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ConnectorKind,
  ConnectorStatus,
} from "@/lib/types/platform";

// ---- Types ----

interface ConnectedConnector {
  id: string;
  kind: ConnectorKind;
  name: string;
  status: ConnectorStatus;
  lastSyncAt: string | null;
  assetCount: number;
  icon?: string;
}

interface AvailableConnector {
  kind: ConnectorKind;
  name: string;
  description: string;
  icon?: string;
}

interface ConnectorGridProps {
  connected: ConnectedConnector[];
  available: AvailableConnector[];
  onSync?: (id: string) => void;
  onConnect?: (kind: ConnectorKind) => void;
  className?: string;
}

// ---- Helpers ----

const STATUS_VARIANT: Record<ConnectorStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  error: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
  paused: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:text-yellow-400",
  pending: "bg-gray-400/10 text-gray-600 border-gray-400/20 dark:text-gray-400",
  disconnected: "bg-slate-400/10 text-slate-600 border-slate-400/20 dark:text-slate-400",
};

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (diffMs < 0) return "just now";
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "< 1h ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---- Component ----

export function ConnectorGrid({
  connected,
  available,
  onSync,
  onConnect,
  className,
}: ConnectorGridProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Connected */}
      {connected.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            Connected
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {connected.map((c) => (
              <Card key={c.id} size="sm">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    {c.icon ? (
                      <span className="text-lg">{c.icon}</span>
                    ) : (
                      <Plug className="size-4 text-muted-foreground" />
                    )}
                    <CardTitle>{c.name}</CardTitle>
                  </div>
                  <CardAction>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full text-[10px] font-semibold capitalize",
                        STATUS_VARIANT[c.status]
                      )}
                    >
                      {c.status}
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Last sync: {formatRelativeTime(c.lastSyncAt)}
                    </span>
                    <span>
                      {c.assetCount.toLocaleString()} asset
                      {c.assetCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => onSync?.(c.id)}
                    >
                      <RefreshCw className="size-3" />
                      Sync
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      render={<a href={`/connectors/${c.id}/settings`} />}
                    >
                      <Settings className="size-3" />
                      Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Available */}
      {available.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            Available
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((a) => (
              <Card key={a.kind} size="sm">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    {a.icon ? (
                      <span className="text-lg">{a.icon}</span>
                    ) : (
                      <Plug className="size-4 text-muted-foreground" />
                    )}
                    <CardTitle>{a.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
                    {a.description}
                  </p>
                  <Button
                    variant="default"
                    size="xs"
                    onClick={() => onConnect?.(a.kind)}
                  >
                    Connect
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
