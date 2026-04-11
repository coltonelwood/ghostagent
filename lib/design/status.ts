/**
 * Status → visual variant maps for ownership, connectors, and policies.
 */

export type OwnerStatus =
  | "active_owner"
  | "inactive_owner"
  | "unknown_owner"
  | "orphaned"
  | "reassignment_pending"
  | "reviewed_unassigned";

export const OWNER_STATUS_META: Record<
  OwnerStatus,
  { label: string; dotClass: string; tone: "success" | "warning" | "danger" | "neutral" }
> = {
  active_owner: { label: "Active", dotClass: "bg-success", tone: "success" },
  inactive_owner: { label: "Inactive", dotClass: "bg-warning", tone: "warning" },
  unknown_owner: { label: "Unknown", dotClass: "bg-muted-foreground", tone: "neutral" },
  orphaned: { label: "Orphaned", dotClass: "bg-destructive", tone: "danger" },
  reassignment_pending: {
    label: "Reassigning",
    dotClass: "bg-info",
    tone: "neutral",
  },
  reviewed_unassigned: {
    label: "Unassigned",
    dotClass: "bg-muted-foreground",
    tone: "neutral",
  },
};

export function ownerStatusMeta(status: string | null | undefined) {
  if (!status) return OWNER_STATUS_META.unknown_owner;
  return (
    OWNER_STATUS_META[status as OwnerStatus] ?? OWNER_STATUS_META.unknown_owner
  );
}

// ---- Connector status ---------------------------------------------------

export type ConnectorStatus =
  | "active"
  | "syncing"
  | "error"
  | "paused"
  | "pending"
  | "disconnected";

export const CONNECTOR_STATUS_META: Record<
  ConnectorStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  active: {
    label: "Connected",
    dotClass: "bg-success",
    textClass: "text-success",
  },
  syncing: {
    label: "Syncing",
    dotClass: "bg-info animate-pulse",
    textClass: "text-info",
  },
  error: {
    label: "Error",
    dotClass: "bg-destructive",
    textClass: "text-destructive",
  },
  paused: {
    label: "Paused",
    dotClass: "bg-warning",
    textClass: "text-warning",
  },
  pending: {
    label: "Pending",
    dotClass: "bg-muted-foreground",
    textClass: "text-muted-foreground",
  },
  disconnected: {
    label: "Disconnected",
    dotClass: "bg-muted-foreground",
    textClass: "text-muted-foreground",
  },
};

export function connectorStatusMeta(status: string | null | undefined) {
  if (!status) return CONNECTOR_STATUS_META.pending;
  return (
    CONNECTOR_STATUS_META[status as ConnectorStatus] ??
    CONNECTOR_STATUS_META.pending
  );
}

// ---- Event severity -----------------------------------------------------

export type EventSeverity = "critical" | "high" | "medium" | "low" | "info";

export const EVENT_SEVERITY_META: Record<
  EventSeverity,
  { label: string; dotClass: string; borderClass: string; textClass: string }
> = {
  critical: {
    label: "Critical",
    dotClass: "bg-destructive",
    borderClass: "border-l-destructive",
    textClass: "text-destructive",
  },
  high: {
    label: "High",
    dotClass: "bg-warning",
    borderClass: "border-l-warning",
    textClass: "text-warning",
  },
  medium: {
    label: "Medium",
    dotClass: "bg-info",
    borderClass: "border-l-info",
    textClass: "text-info",
  },
  low: {
    label: "Low",
    dotClass: "bg-success",
    borderClass: "border-l-success",
    textClass: "text-success",
  },
  info: {
    label: "Info",
    dotClass: "bg-muted-foreground",
    borderClass: "border-l-border",
    textClass: "text-muted-foreground",
  },
};

export function eventSeverityMeta(severity: string | null | undefined) {
  if (!severity) return EVENT_SEVERITY_META.info;
  return (
    EVENT_SEVERITY_META[severity as EventSeverity] ?? EVENT_SEVERITY_META.info
  );
}
