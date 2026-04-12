"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  RefreshCw,
  Trash2,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";

interface SyncRecord {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  assets_found: number;
  assets_created: number;
  assets_updated: number;
  assets_removed: number;
  error: string | null;
}

interface ConnectorData {
  id: string;
  kind: string;
  name: string;
  status: string;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  last_sync_asset_count: number | null;
  enabled: boolean;
  sync_schedule: string;
  created_at: string;
  syncs: SyncRecord[];
}

const SYNC_STATUS_ICON: Record<string, React.ReactNode> = {
  completed: <CheckCircle className="size-4 text-green-500" />,
  failed: <XCircle className="size-4 text-red-500" />,
  running: <RefreshCw className="size-4 animate-spin text-blue-500" />,
  partial: <Clock className="size-4 text-yellow-500" />,
};

export function ConnectorDetail({ connector }: { connector: ConnectorData }) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  // Optimistic "just clicked Sync Now" flag — cleared once the server
  // reports a running sync or 5s passes (whichever comes first). The
  // canonical in-flight state is the server's most recent sync record.
  const [justClicked, setJustClicked] = useState(false);
  const toastedSyncIds = useRef<Set<string>>(new Set());
  // Only toast about syncs the user initiated from this session.
  const userInitiatedSession = useRef(false);

  const latestSync = connector.syncs[0];
  const serverRunning = latestSync?.status === "running";
  const inFlight = serverRunning || justClicked;

  // Expire the optimistic flag after 5 seconds as a safety net. By then
  // either a running sync has shown up on the server (which keeps the
  // banner visible anyway) or something went wrong and we stop claiming
  // it's in-flight.
  useEffect(() => {
    if (!justClicked) return;
    const t = setTimeout(() => setJustClicked(false), 5000);
    return () => clearTimeout(t);
  }, [justClicked]);

  // Poll every 3s while the server reports a running sync.
  const refreshFromServer = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!serverRunning) return;
    const interval = setInterval(refreshFromServer, 3000);
    return () => clearInterval(interval);
  }, [serverRunning, refreshFromServer]);

  // Toast on completion / failure, once per sync id, only if the user
  // initiated the sync from this page load.
  useEffect(() => {
    if (!userInitiatedSession.current) return;
    if (!latestSync) return;
    if (latestSync.status === "running") return;
    if (toastedSyncIds.current.has(latestSync.id)) return;
    toastedSyncIds.current.add(latestSync.id);
    if (latestSync.status === "completed") {
      toast.success(
        `Sync complete — ${latestSync.assets_found ?? 0} asset${
          (latestSync.assets_found ?? 0) === 1 ? "" : "s"
        } found`,
      );
    } else if (latestSync.status === "failed") {
      toast.error(
        latestSync.error ?? "Sync failed — check credentials and try again.",
      );
    }
  }, [latestSync]);

  const handleSync = async () => {
    userInitiatedSession.current = true;
    setJustClicked(true);
    try {
      const res = await fetch(`/api/connectors/${connector.id}/sync`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to start sync");
        setJustClicked(false);
        return;
      }
      toast.success("Sync started — results will appear shortly");
      setTimeout(() => router.refresh(), 1500);
    } catch {
      toast.error("Failed to start sync. Please try again.");
      setJustClicked(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/connectors/${connector.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to disconnect connector");
        setDisconnecting(false);
        return;
      }
      toast.success("Connector disconnected");
      router.push("/platform/connectors");
    } catch {
      toast.error("Failed to disconnect. Please try again.");
      setDisconnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link
            href="/platform/connectors"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            Back to Connectors
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            {connector.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {connector.kind}
            </Badge>
            <Badge
              variant={
                connector.status === "active"
                  ? "secondary"
                  : connector.status === "error"
                    ? "destructive"
                    : "outline"
              }
              className="capitalize"
            >
              {connector.status}
            </Badge>
            {!connector.enabled && (
              <Badge variant="outline">Disabled</Badge>
            )}
            {inFlight && (
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-info/20 bg-info/10 px-1.5 py-0.5 text-[11px] font-medium text-info">
                <RefreshCw className="size-3 animate-spin" />
                Syncing
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={inFlight}
          >
            <RefreshCw
              className={`size-4 ${inFlight ? "animate-spin" : ""}`}
            />
            {inFlight ? "Syncing..." : "Sync Now"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const newStatus = connector.status === "paused" ? "active" : "paused";
              try {
                const res = await fetch(`/api/connectors/${connector.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: newStatus }),
                });
                if (!res.ok) throw new Error();
                toast.success(newStatus === "paused" ? "Connector paused" : "Connector resumed");
                window.location.reload();
              } catch {
                toast.error("Failed to update connector status");
              }
            }}
          >
            <Settings className="size-4" />
            {connector.status === "paused" ? "Resume" : "Pause"}
          </Button>
          <Dialog>
            <DialogTrigger
              render={
                <Button variant="destructive" size="sm">
                  <Trash2 className="size-4" />
                  Disconnect
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Disconnect {connector.name}?</DialogTitle>
                <DialogDescription>
                  This will stop syncing and remove stored credentials. Existing
                  assets will remain but will no longer be updated.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose
                  render={<Button variant="outline">Cancel</Button>}
                />
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <span className="text-sm text-muted-foreground">Status</span>
          </CardHeader>
          <CardContent>
            <span className="text-lg font-bold capitalize">
              {connector.status}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <span className="text-sm text-muted-foreground">Last Sync</span>
          </CardHeader>
          <CardContent>
            <span className="text-lg font-bold">
              {connector.last_sync_at
                ? new Date(connector.last_sync_at).toLocaleString()
                : "Never"}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <span className="text-sm text-muted-foreground">Assets Found</span>
          </CardHeader>
          <CardContent>
            <span className="text-lg font-bold">
              {connector.last_sync_asset_count ?? 0}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Sync History */}
      <Card>
        <CardHeader>
          <CardTitle>Sync History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {connector.syncs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No sync history yet. Click &quot;Sync Now&quot; to trigger the
              first sync.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Assets Found
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    Created
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    Updated
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connector.syncs.map((sync) => (
                  <TableRow key={sync.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {SYNC_STATUS_ICON[sync.status] ?? null}
                        <span className="capitalize">{sync.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(sync.started_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs">
                      {sync.completed_at
                        ? new Date(sync.completed_at).toLocaleString()
                        : "--"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {sync.assets_found}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {sync.assets_created}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {sync.assets_updated}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-destructive max-w-[200px] truncate">
                      {sync.error ?? "--"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
