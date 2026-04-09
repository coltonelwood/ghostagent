"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch(`/api/connectors/${connector.id}/sync`, {
        method: "POST",
      });
      router.refresh();
    } catch {
      // silently fail
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch(`/api/connectors/${connector.id}`, {
        method: "DELETE",
      });
      router.push("/platform/connectors");
    } catch {
      // silently fail
    } finally {
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
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw
              className={`size-4 ${syncing ? "animate-spin" : ""}`}
            />
            {syncing ? "Syncing..." : "Sync Now"}
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
