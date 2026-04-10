"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Database,
  ChevronDown,
} from "lucide-react";

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

const RISK_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const OWNER_STATUS_LABELS: Record<string, string> = {
  active_owner: "Active",
  inactive_owner: "Inactive",
  unknown_owner: "Unknown",
  orphaned: "Orphaned",
  reassignment_pending: "Reassigning",
  reviewed_unassigned: "Unassigned",
};

function AssetRiskBadge({ level }: { level: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${RISK_COLORS[level] ?? ""}`}
    >
      {level}
    </span>
  );
}

function OwnerBadge({ status }: { status: string }) {
  const isOrphaned = status === "orphaned";
  return (
    <Badge variant={isOrphaned ? "destructive" : "outline"}>
      {OWNER_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1">
            {label}
            {value && `: ${options.find((o) => o.value === value)?.label ?? value}`}
            <ChevronDown className="size-3" />
          </Button>
        }
      />
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => onChange("")}>All</DropdownMenuItem>
        {options.map((opt) => (
          <DropdownMenuItem key={opt.value} onClick={() => onChange(opt.value)}>
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [ownerStatus, setOwnerStatus] = useState("");
  const [status, setStatus] = useState("");

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (source) params.set("source", source);
    if (riskLevel) params.set("risk_level", riskLevel);
    if (ownerStatus) params.set("owner_status", ownerStatus);
    if (status) params.set("status", status);

    try {
      const res = await fetch(`/api/assets?${params}`);
      if (res.ok) {
        const json = await res.json();
        setAssets(json.data ?? []);
        setTotal(json.total ?? 0);
        setHasMore(json.hasMore ?? false);
      }
    } catch {
      // Silently handle fetch errors
    } finally {
      setLoading(false);
    }
  }, [page, search, source, riskLevel, ownerStatus, status]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, source, riskLevel, ownerStatus, status]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Asset Registry</h1>
        <p className="text-muted-foreground">
          Discover and manage all AI assets across your organization.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <FilterDropdown
          label="Source"
          value={source}
          options={[
            { value: "github", label: "GitHub" },
            { value: "gitlab", label: "GitLab" },
            { value: "aws", label: "AWS" },
            { value: "gcp", label: "GCP" },
            { value: "azure", label: "Azure" },
            { value: "zapier", label: "Zapier" },
            { value: "n8n", label: "n8n" },
            { value: "make", label: "Make" },
            { value: "sdk", label: "SDK" },
          ]}
          onChange={setSource}
        />
        <FilterDropdown
          label="Risk"
          value={riskLevel}
          options={[
            { value: "critical", label: "Critical" },
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
          ]}
          onChange={setRiskLevel}
        />
        <FilterDropdown
          label="Owner"
          value={ownerStatus}
          options={[
            { value: "active_owner", label: "Active" },
            { value: "orphaned", label: "Orphaned" },
            { value: "unknown_owner", label: "Unknown" },
          ]}
          onChange={setOwnerStatus}
        />
        <FilterDropdown
          label="Status"
          value={status}
          options={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
            { value: "quarantined", label: "Quarantined" },
            { value: "archived", label: "Archived" },
          ]}
          onChange={setStatus}
        />
      </div>

      {/* Asset table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-pulse text-sm text-muted-foreground">
                Loading assets...
              </div>
            </div>
          ) : assets.length === 0 ? (
            <div className="py-16 text-center">
              <Database className="mx-auto size-10 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No assets yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                No assets yet. Connect your first data source to start
                discovering AI assets.
              </p>
              <LinkButton href="/platform/connectors" className="mt-4">Add Connector</LinkButton>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead className="hidden md:table-cell">Owner</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <Link
                        href={`/platform/assets/${asset.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {asset.name}
                      </Link>
                      {asset.description && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground max-w-[200px]">
                          {asset.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{asset.source}</Badge>
                    </TableCell>
                    <TableCell>
                      <AssetRiskBadge level={asset.risk_level} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <OwnerBadge status={asset.owner_status} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className="capitalize">
                        {asset.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {new Date(asset.last_seen_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of{" "}
            {total} assets
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
