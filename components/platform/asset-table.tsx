"use client";

import { useState, useCallback, useMemo } from "react";
import {
  ArrowUpDown,
  MoreHorizontal,
  UserPlus,
  Tag,
  Archive,
  CheckCircle2,
  PackageSearch,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AssetRiskBadge } from "./asset-risk-badge";
import { OwnerBadge } from "./owner-badge";
import type { Asset } from "@/lib/types/platform";

// ---- Types ----

type SortKey =
  | "name"
  | "source"
  | "kind"
  | "risk_score"
  | "status"
  | "last_seen_at";
type SortDir = "asc" | "desc";
type BulkActionType = "reassign" | "tag" | "archive" | "mark_reviewed";

interface AssetTableProps {
  assets: Asset[];
  loading?: boolean;
  selectedIds?: Set<string>;
  onSelect?: (ids: Set<string>) => void;
  onBulkAction?: (action: BulkActionType, ids: string[]) => void;
  emptyMessage?: string;
  className?: string;
}

// ---- Helpers ----

function formatRelativeDate(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return "just now";
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "< 1h ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function ownerStatusShort(
  status: string
): "active" | "inactive" | "unknown" | "orphaned" | "pending" {
  if (status === "active_owner") return "active";
  if (status === "inactive_owner") return "inactive";
  if (status === "orphaned") return "orphaned";
  if (status === "reassignment_pending") return "pending";
  return "unknown";
}

// ---- Skeleton ----

function SkeletonRow() {
  return (
    <TableRow>
      {Array.from({ length: 9 }).map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
        </TableCell>
      ))}
    </TableRow>
  );
}

// ---- Sortable header (declared at module scope so it is stable) ----

function SortHeader({
  label,
  field,
  activeField,
  onToggle,
}: {
  label: string;
  field: SortKey;
  activeField: SortKey;
  onToggle: (field: SortKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {label}
      <ArrowUpDown
        className={cn(
          "size-3",
          activeField === field ? "opacity-100" : "opacity-30",
        )}
      />
    </button>
  );
}

// ---- Component ----

export function AssetTable({
  assets,
  loading = false,
  selectedIds: controlledSelected,
  onSelect,
  onBulkAction,
  emptyMessage = "No assets found. Connect a source to discover assets.",
  className,
}: AssetTableProps) {
  const [internalSelected, setInternalSelected] = useState<Set<string>>(
    new Set()
  );
  const [sortKey, setSortKey] = useState<SortKey>("risk_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const selected = controlledSelected ?? internalSelected;
  const setSelected = useCallback(
    (ids: Set<string>) => {
      if (onSelect) {
        onSelect(ids);
      } else {
        setInternalSelected(ids);
      }
    },
    [onSelect]
  );

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey]
  );

  const sorted = useMemo(() => {
    const copy = [...assets];
    copy.sort((a, b) => {
      let cmp = 0;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        cmp = av.localeCompare(bv);
      } else if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [assets, sortKey, sortDir]);

  const allSelected =
    assets.length > 0 && selected.size === assets.length;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(assets.map((a) => a.id)));
    }
  }, [allSelected, assets, setSelected]);

  const toggleRow = useCallback(
    (id: string) => {
      const next = new Set(selected);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      setSelected(next);
    },
    [selected, setSelected]
  );

  const handleBulk = useCallback(
    (action: BulkActionType) => {
      onBulkAction?.(action, Array.from(selected));
    },
    [onBulkAction, selected]
  );

  // ---- Render ----

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => handleBulk("reassign")}
            >
              <UserPlus className="size-3" />
              Reassign
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => handleBulk("tag")}
            >
              <Tag className="size-3" />
              Tag
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => handleBulk("archive")}
            >
              <Archive className="size-3" />
              Archive
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => handleBulk("mark_reviewed")}
            >
              <CheckCircle2 className="size-3" />
              Mark Reviewed
            </Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="size-4 rounded border-input"
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>
              <SortHeader label="Name" field="name" activeField={sortKey} onToggle={toggleSort} />
            </TableHead>
            <TableHead>
              <SortHeader label="Source" field="source" activeField={sortKey} onToggle={toggleSort} />
            </TableHead>
            <TableHead>
              <SortHeader label="Kind" field="kind" activeField={sortKey} onToggle={toggleSort} />
            </TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>
              <SortHeader label="Risk" field="risk_score" activeField={sortKey} onToggle={toggleSort} />
            </TableHead>
            <TableHead>
              <SortHeader label="Status" field="status" activeField={sortKey} onToggle={toggleSort} />
            </TableHead>
            <TableHead>
              <SortHeader label="Last Seen" field="last_seen_at" activeField={sortKey} onToggle={toggleSort} />
            </TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))
          ) : sorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9}>
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <PackageSearch className="size-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    {emptyMessage}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((asset) => (
              <TableRow
                key={asset.id}
                data-state={selected.has(asset.id) ? "selected" : undefined}
              >
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selected.has(asset.id)}
                    onChange={() => toggleRow(asset.id)}
                    className="size-4 rounded border-input"
                    aria-label={`Select ${asset.name}`}
                  />
                </TableCell>
                <TableCell>
                  <a
                    href={`/assets/${asset.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {asset.name}
                  </a>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {asset.source}
                </TableCell>
                <TableCell className="text-muted-foreground capitalize">
                  {asset.kind}
                </TableCell>
                <TableCell>
                  <OwnerBadge
                    name={null}
                    email={asset.owner_email}
                    status={ownerStatusShort(asset.owner_status)}
                  />
                </TableCell>
                <TableCell>
                  <AssetRiskBadge
                    level={asset.risk_level}
                    score={asset.risk_score}
                    size="sm"
                  />
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
                      asset.status === "active" &&
                        "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                      asset.status === "inactive" &&
                        "border-gray-400/20 bg-gray-400/10 text-gray-600 dark:text-gray-400",
                      asset.status === "quarantined" &&
                        "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
                      asset.status === "archived" &&
                        "border-slate-400/20 bg-slate-400/10 text-slate-600 dark:text-slate-400",
                      asset.status === "decommissioned" &&
                        "border-slate-400/20 bg-slate-400/10 text-slate-500"
                    )}
                  >
                    {asset.status}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatRelativeDate(asset.last_seen_at)}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-xs" aria-label="Actions">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
