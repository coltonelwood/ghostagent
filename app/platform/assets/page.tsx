"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Plug,
  MoreHorizontal,
  CheckCircle2,
  UserPlus,
  ShieldOff,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { RiskBadge } from "@/components/ui/risk-badge";
import { FilterBar, FacetDropdown } from "@/components/platform/filter-bar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ownerStatusMeta } from "@/lib/design/status";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface Asset {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  source: string;
  risk_level: string;
  risk_score: number;
  owner_email: string | null;
  owner_status: string;
  status: string;
  environment: string;
  last_seen_at: string;
  created_at: string;
}

const SOURCE_OPTIONS = [
  { value: "github", label: "GitHub" },
  { value: "gitlab", label: "GitLab" },
  { value: "aws", label: "AWS" },
  { value: "gcp", label: "Google Cloud" },
  { value: "azure", label: "Azure" },
  { value: "zapier", label: "Zapier" },
  { value: "n8n", label: "n8n" },
  { value: "make", label: "Make" },
  { value: "sdk", label: "SDK" },
];

const RISK_OPTIONS = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const OWNER_OPTIONS = [
  { value: "active_owner", label: "Active" },
  { value: "inactive_owner", label: "Inactive" },
  { value: "unknown_owner", label: "Unknown" },
  { value: "orphaned", label: "Orphaned" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "quarantined", label: "Quarantined" },
  { value: "archived", label: "Archived" },
];

const KIND_OPTIONS = [
  { value: "agent", label: "Agent" },
  { value: "pipeline", label: "Pipeline" },
  { value: "workflow", label: "Workflow" },
  { value: "function", label: "Function" },
  { value: "script", label: "Script" },
  { value: "model", label: "Model" },
  { value: "integration", label: "Integration" },
  { value: "api", label: "API" },
  { value: "sdk_reported", label: "SDK Reported" },
];

const SAVED_VIEWS = [
  { id: "all", label: "All assets" },
  { id: "agents", label: "Agents" },
  { id: "critical", label: "Critical & high" },
  { id: "orphaned", label: "Orphaned" },
  { id: "production", label: "Production" },
];

// --------------------------------------------------------------------------
// Owner badge
// --------------------------------------------------------------------------

function OwnerCell({
  email,
  status,
}: {
  email: string | null;
  status: string;
}) {
  const meta = ownerStatusMeta(status);
  const displayName = email ? email.split("@")[0] : "Unassigned";

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className={cn("inline-block size-1.5 rounded-full shrink-0", meta.dotClass)} />
      <div className="min-w-0">
        <p className="truncate text-[13px] text-foreground">
          {email ? displayName : <span className="text-muted-foreground">—</span>}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">{meta.label}</p>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Bulk action bar
// --------------------------------------------------------------------------

function BulkActionBar({
  count,
  onAction,
  onClear,
  loading,
}: {
  count: number;
  onAction: (action: string) => void;
  onClear: () => void;
  loading: boolean;
}) {
  if (count === 0) return null;
  return (
    <div className="sticky bottom-4 z-10 mx-auto flex items-center gap-2 rounded-md border border-border bg-popover px-3 py-2 shadow-md w-fit">
      <span className="text-xs font-medium">
        <span className="nx-tabular">{count}</span> selected
      </span>
      <div className="h-4 w-px bg-border" />
      <Button variant="ghost" size="xs" disabled={loading} onClick={() => onAction("reassign")}>
        Reassign
      </Button>
      <Button variant="ghost" size="xs" disabled={loading} onClick={() => onAction("tag")}>
        Tag
      </Button>
      <Button variant="ghost" size="xs" disabled={loading} onClick={() => onAction("review")}>
        Mark reviewed
      </Button>
      <Button variant="ghost" size="xs" disabled={loading} onClick={() => onAction("archive")}>
        Archive
      </Button>
      <div className="h-4 w-px bg-border" />
      <button
        type="button"
        onClick={onClear}
        disabled={loading}
        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        Clear
      </button>
    </div>
  );
}

// --------------------------------------------------------------------------
// Skeleton row
// --------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <TableRow>
      {Array.from({ length: 7 }).map((_, i) => (
        <TableCell key={i} className="py-3">
          <div className="h-3.5 w-full max-w-[120px] animate-pulse rounded bg-muted" />
        </TableCell>
      ))}
    </TableRow>
  );
}

// --------------------------------------------------------------------------
// Row action menu
// --------------------------------------------------------------------------

function RowActionMenu({
  asset,
  onUpdated,
}: {
  asset: Asset;
  onUpdated: () => void;
}) {
  const [acting, setActing] = useState(false);

  async function markReviewed() {
    setActing(true);
    try {
      const res = await fetch(`/api/assets/${asset.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_status: "reviewed" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Asset marked as reviewed");
      onUpdated();
    } catch {
      toast.error("Failed to update review status");
    } finally {
      setActing(false);
    }
  }

  async function assignOwner() {
    const email = window.prompt("Enter the new owner's email address:");
    if (!email?.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }
    setActing(true);
    try {
      const res = await fetch(`/api/assets/${asset.id}/reassign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner_email: email.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Owner set to ${email.trim()}`);
      onUpdated();
    } catch {
      toast.error("Failed to reassign owner");
    } finally {
      setActing(false);
    }
  }

  async function quarantineAsset() {
    if (
      !window.confirm(
        "Quarantine this asset? It will be flagged as quarantined and all related policies will be re-evaluated.",
      )
    )
      return;
    setActing(true);
    try {
      const res = await fetch(`/api/assets/${asset.id}/quarantine`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Manual quarantine from asset table" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Asset quarantined");
      onUpdated();
    } catch {
      toast.error("Failed to quarantine asset");
    } finally {
      setActing(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={acting}
        className="inline-flex items-center justify-center rounded-md size-7 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        aria-label="Row actions"
      >
        <MoreHorizontal className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" sideOffset={4}>
        <DropdownMenuItem onClick={markReviewed}>
          <CheckCircle2 className="size-4" />
          Mark reviewed
        </DropdownMenuItem>
        <DropdownMenuItem onClick={assignOwner}>
          <UserPlus className="size-4" />
          Assign owner
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={quarantineAsset}>
          <ShieldOff className="size-4" />
          Quarantine
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// --------------------------------------------------------------------------
// Main page
// --------------------------------------------------------------------------

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [risk, setRisk] = useState<string[]>([]);
  const [owner, setOwner] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>([]);
  const [kind, setKind] = useState<string[]>([]);
  const [activeView, setActiveView] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  function applyView(id: string) {
    setActiveView(id);
    setRisk([]);
    setOwner([]);
    setStatus([]);
    setKind([]);
    setPage(1);
    if (id === "agents") setKind(["agent"]);
    else if (id === "critical") setRisk(["critical", "high"]);
    else if (id === "orphaned") setOwner(["orphaned"]);
    else if (id === "production") setStatus(["active"]);
  }

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (sources.length) params.set("source", sources.join(","));
    if (risk.length) params.set("risk_level", risk.join(","));
    if (owner.length) params.set("owner_status", owner.join(","));
    if (status.length) params.set("status", status.join(","));
    if (kind.length) params.set("kind", kind.join(","));

    try {
      const res = await fetch(`/api/assets?${params}`);
      if (res.ok) {
        const json = await res.json();
        setAssets(json.data ?? []);
        setTotal(json.total ?? 0);
        setHasMore(json.hasMore ?? false);
      }
    } catch {
      toast.error("Failed to load assets. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [page, search, sources, risk, owner, status, kind]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  useEffect(() => {
    setPage(1);
  }, [search, sources, risk, owner, status, kind]);

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === assets.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(assets.map((a) => a.id)));
    }
  }

  const allSelected = assets.length > 0 && selected.size === assets.length;
  const hasFilters =
    search.length > 0 ||
    sources.length > 0 ||
    risk.length > 0 ||
    owner.length > 0 ||
    status.length > 0;

  function clearAllFilters() {
    setSearch("");
    setSources([]);
    setRisk([]);
    setOwner([]);
    setStatus([]);
    setActiveView("all");
  }

  async function handleBulkAction(action: string) {
    const ids = Array.from(selected);
    let payload: Record<string, unknown> = {};

    if (action === "reassign") {
      const ownerEmail = window.prompt("Enter the new owner email address:");
      if (!ownerEmail) return;
      payload = { owner_email: ownerEmail.trim() };
    }

    if (action === "tag") {
      const tagName = window.prompt("Enter a tag name to apply:");
      if (!tagName) return;
      payload = { tags: [tagName.trim()] };
    }

    if (action === "review") {
      payload = { review_status: "reviewed" };
    }

    setBulkLoading(true);
    try {
      const res = await fetch("/api/assets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_ids: ids, action, payload }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.error ?? `Bulk ${action} failed`);
        return;
      }

      const json = await res.json();
      const count = json.updated ?? ids.length;
      const label =
        action === "review"
          ? "marked reviewed"
          : action === "archive"
            ? "archived"
            : action === "reassign"
              ? "reassigned"
              : "tagged";
      toast.success(
        `Successfully ${label} ${count} asset${count === 1 ? "" : "s"}`,
      );

      setSelected(new Set());
      fetchAssets();
    } catch {
      toast.error(`Failed to ${action} assets. Please try again.`);
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset registry"
        description="Every AI system Spekris has discovered across your connected sources."
        meta={
          total > 0 && (
            <>
              <span className="nx-tabular">{total}</span>
              <span>{total === 1 ? "asset" : "assets"}</span>
              <span>·</span>
              <span>Last synced {new Date().toLocaleTimeString()}</span>
            </>
          )
        }
        primaryAction={
          <Link
            href="/platform/connectors"
            className={buttonVariants({ size: "sm" })}
          >
            <Plug className="size-3.5" />
            Add connector
          </Link>
        }
        secondaryActions={
          <Button variant="outline" size="sm">
            <Download className="size-3.5" />
            Export CSV
          </Button>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        savedViews={SAVED_VIEWS}
        activeView={activeView}
        onViewChange={applyView}
        facets={
          <>
            <FacetDropdown
              label="Source"
              options={SOURCE_OPTIONS}
              selected={sources}
              onChange={setSources}
            />
            <FacetDropdown
              label="Risk"
              options={RISK_OPTIONS}
              selected={risk}
              onChange={setRisk}
            />
            <FacetDropdown
              label="Owner"
              options={OWNER_OPTIONS}
              selected={owner}
              onChange={setOwner}
            />
            <FacetDropdown
              label="Type"
              options={KIND_OPTIONS}
              selected={kind}
              onChange={setKind}
            />
            <FacetDropdown
              label="Status"
              options={STATUS_OPTIONS}
              selected={status}
              onChange={setStatus}
            />
          </>
        }
      />

      <div className="nx-surface overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-10 pl-4">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="size-3.5 rounded border-border"
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Name
              </TableHead>
              <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Source
              </TableHead>
              <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Owner
              </TableHead>
              <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Risk
              </TableHead>
              <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Environment
              </TableHead>
              <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Last seen
              </TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            ) : assets.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-0">
                  {hasFilters ? (
                    <EmptyState
                      variant="inline"
                      icon={Database}
                      title="No assets match your filters"
                      description="Try clearing filters or adjusting your search."
                      primaryAction={
                        <Button variant="outline" size="sm" onClick={clearAllFilters}>
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      variant="inline"
                      icon={Database}
                      title="No assets yet"
                      description="Connect your first source to start discovering AI systems."
                      primaryAction={
                        <Link
                          href="/platform/connectors"
                          className={buttonVariants({ size: "sm" })}
                        >
                          Add connector
                        </Link>
                      }
                    />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              assets.map((asset) => {
                const isSelected = selected.has(asset.id);
                return (
                  <TableRow
                    key={asset.id}
                    data-state={isSelected ? "selected" : undefined}
                    className="h-12 hover:bg-muted/40"
                  >
                    <TableCell className="pl-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(asset.id)}
                        className="size-3.5 rounded border-border"
                        aria-label={`Select ${asset.name}`}
                      />
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <Link
                        href={`/platform/assets/${asset.id}`}
                        className="block min-w-0"
                      >
                        <p className="truncate text-[13px] font-medium text-foreground">
                          {asset.name}
                        </p>
                        {asset.description && (
                          <p className="truncate text-[11px] text-muted-foreground">
                            {asset.description}
                          </p>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex h-5 items-center rounded-sm border border-border px-1.5 text-[11px] capitalize text-muted-foreground">
                        {asset.source}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <OwnerCell email={asset.owner_email} status={asset.owner_status} />
                    </TableCell>
                    <TableCell>
                      <RiskBadge
                        level={asset.risk_level}
                        score={asset.risk_score}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell className="text-[12px] capitalize text-muted-foreground">
                      {asset.environment}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground nx-tabular">
                      {formatRelative(asset.last_seen_at)}
                    </TableCell>
                    <TableCell className="pr-3">
                      <RowActionMenu
                        asset={asset}
                        onUpdated={fetchAssets}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {total > 0 && !loading && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            <p className="nx-tabular">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="xs"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="size-3" />
                Previous
              </Button>
              <Button
                variant="ghost"
                size="xs"
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="size-3" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <BulkActionBar
        count={selected.size}
        onAction={handleBulkAction}
        onClear={() => setSelected(new Set())}
        loading={bulkLoading}
      />
    </div>
  );
}

// --------------------------------------------------------------------------

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
