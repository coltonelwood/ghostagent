"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Shield, Play, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { RiskBadge } from "@/components/ui/risk-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Policy } from "@/lib/types/platform";

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function PoliciesPage() {
  const router = useRouter();
  const [policies, setPolicies] = useState<
    (Policy & { policy_violations?: [{ count: number }] })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/policies")
      .then((r) => r.json())
      .then((d) => setPolicies(d.data ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  async function runPolicy(policyId: string) {
    setRunning(policyId);
    try {
      const res = await fetch(`/api/policies/${policyId}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to run policy");
      } else {
        const violations = data.data?.violations_found ?? 0;
        toast.success(
          violations > 0
            ? `Policy evaluated — ${violations} violation${violations !== 1 ? "s" : ""} found`
            : "Policy evaluated — no violations found",
        );
      }
      load();
    } catch {
      toast.error("Failed to run policy");
    } finally {
      setRunning(null);
    }
  }

  async function toggleEnabled(policy: Policy) {
    setToggling(policy.id);
    try {
      const res = await fetch(`/api/policies/${policy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !policy.enabled }),
      });
      if (!res.ok) {
        toast.error("Failed to update policy");
        return;
      }
      setPolicies((prev) =>
        prev.map((p) => (p.id === policy.id ? { ...p, enabled: !p.enabled } : p)),
      );
      toast.success(policy.enabled ? "Policy disabled" : "Policy enabled");
    } catch {
      toast.error("Failed to update policy");
    } finally {
      setToggling(null);
    }
  }

  async function deletePolicy(policyId: string) {
    if (!confirm("Delete this policy? All violations will also be removed.")) return;
    setDeleting(policyId);
    try {
      const res = await fetch(`/api/policies/${policyId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete policy");
        return;
      }
      setPolicies((prev) => prev.filter((p) => p.id !== policyId));
      toast.success("Policy deleted");
    } catch {
      toast.error("Failed to delete policy");
    } finally {
      setDeleting(null);
    }
  }

  const activeCount = policies.filter((p) => p.enabled).length;
  const violationCount = policies.reduce(
    (sum, p) => sum + (p.policy_violations?.[0]?.count ?? p.last_run_violations ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Policies"
        description="Rules that detect and alert on AI governance issues — orphaned agents, missing ownership, compliance gaps."
        meta={
          !loading && policies.length > 0 && (
            <>
              <span className="nx-tabular">{activeCount}</span>
              <span>active</span>
              <span>·</span>
              <span className="nx-tabular">{policies.length}</span>
              <span>total</span>
              {violationCount > 0 && (
                <>
                  <span>·</span>
                  <span className="text-destructive nx-tabular">{violationCount}</span>
                  <span className="text-destructive">open violations</span>
                </>
              )}
            </>
          )
        }
        primaryAction={
          <Link
            href="/platform/policies/new"
            className={buttonVariants({ size: "sm" })}
          >
            <Plus className="size-3.5" />
            New policy
          </Link>
        }
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg border border-border bg-muted/30"
            />
          ))}
        </div>
      ) : policies.length === 0 ? (
        <div className="nx-surface">
          <EmptyState
            icon={Shield}
            title="No policies yet"
            description="Create your first policy to automatically detect orphaned agents, high-risk systems, and compliance gaps across your AI inventory."
            primaryAction={
              <Link
                href="/platform/policies/new"
                className={buttonVariants({ size: "sm" })}
              >
                <Plus className="size-3.5" />
                Create your first policy
              </Link>
            }
          />
        </div>
      ) : (
        <div className="nx-surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground pl-4">
                  Name
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Severity
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Enabled
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Violations
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Last run
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground text-right pr-4">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy) => {
                const count =
                  policy.policy_violations?.[0]?.count ??
                  policy.last_run_violations ??
                  0;
                return (
                  <TableRow key={policy.id} className="h-12 hover:bg-muted/40">
                    <TableCell className="pl-4 max-w-[320px]">
                      <Link
                        href={`/platform/policies/${policy.id}`}
                        className="block min-w-0"
                      >
                        <p className="truncate text-[13px] font-medium">
                          {policy.name}
                        </p>
                        {policy.description && (
                          <p className="truncate text-[11px] text-muted-foreground">
                            {policy.description}
                          </p>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <RiskBadge
                        level={
                          policy.severity === "critical" ||
                          policy.severity === "high"
                            ? policy.severity
                            : policy.severity === "medium"
                              ? "medium"
                              : "low"
                        }
                        size="sm"
                      />
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => toggleEnabled(policy)}
                        disabled={toggling === policy.id}
                        className={cn(
                          "relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          policy.enabled ? "bg-primary" : "bg-muted",
                        )}
                        aria-label={policy.enabled ? "Disable policy" : "Enable policy"}
                      >
                        <span
                          className={cn(
                            "inline-block h-3 w-3 rounded-full bg-white transition-transform",
                            policy.enabled ? "translate-x-3.5" : "translate-x-0.5",
                          )}
                        />
                      </button>
                    </TableCell>
                    <TableCell>
                      {count > 0 ? (
                        <span className="inline-flex h-5 items-center rounded-sm border border-destructive/20 bg-destructive/10 px-1.5 text-[11px] font-medium text-destructive nx-tabular">
                          {count} open
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground nx-tabular">
                      {policy.last_run_at ? timeAgo(policy.last_run_at) : "Never"}
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => router.push(`/platform/policies/${policy.id}`)}
                          aria-label="Edit"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => runPolicy(policy.id)}
                          disabled={running === policy.id}
                          aria-label="Run now"
                        >
                          {running === policy.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Play className="size-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => deletePolicy(policy.id)}
                          disabled={deleting === policy.id}
                          aria-label="Delete"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          {deleting === policy.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
