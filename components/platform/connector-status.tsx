import { cn } from "@/lib/utils";
import type { ConnectorStatus as ConnectorStatusType } from "@/lib/types/platform";

interface ConnectorStatusProps {
  status: ConnectorStatusType;
  lastSyncAt?: string | null;
  assetCount?: number | null;
  className?: string;
}

const STATUS_DOT: Record<ConnectorStatusType, string> = {
  active: "bg-emerald-500",
  error: "bg-red-500",
  paused: "bg-yellow-500",
  pending: "bg-gray-400",
  disconnected: "bg-slate-400",
};

const STATUS_LABEL: Record<ConnectorStatusType, string> = {
  active: "Active",
  error: "Error",
  paused: "Paused",
  pending: "Pending",
  disconnected: "Disconnected",
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

export function ConnectorStatusIndicator({
  status,
  lastSyncAt,
  assetCount,
  className,
}: ConnectorStatusProps) {
  return (
    <div className={cn("flex flex-col gap-1 text-sm", className)}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            STATUS_DOT[status]
          )}
        />
        <span className="font-medium text-foreground">
          {STATUS_LABEL[status]}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          Last sync:{" "}
          {lastSyncAt ? formatRelativeTime(lastSyncAt) : "Never"}
        </span>
        {assetCount != null && (
          <>
            <span className="text-border">|</span>
            <span>
              {assetCount.toLocaleString()} asset{assetCount === 1 ? "" : "s"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
