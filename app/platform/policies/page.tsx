"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Shield, Play, Pencil, Trash2, Loader2, Zap } from "lucide-react";
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

// --------------------------------------------------------------------------
// Pre-built policy templates
// --------------------------------------------------------------------------

interface PolicyTemplate {
  name: string;
  description: string;
  severity: string;
  conditions: {
    operator: "AND" | "OR";
    rules: Array<{ field: string; op: string; value: unknown }>;
  };
  actions: Array<{ type: string; config?: Record<string, unknown> }>;
}

const POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    name: "Flag unowned AI systems",
    description:
      "Automatically flag any AI system that has no assigned owner, so orphaned assets get immediate visibility.",
    severity: "high",
    conditions: {
      operator: "AND",
      rules: [{ field: "owner_status", op: "eq", value: "orphaned" }],
    },
    actions: [{ type: "mark_flagged" }],
  },
  {
    name: "Alert on critical risk",
    description:
      "Send an admin alert whenever an AI system is classified as critical risk, ensuring fast response.",
    severity: "critical",
    conditions: {
      operator: "AND",
      rules: [{ field: "risk_level", op: "eq", value: "critical" }],
    },
    actions: [{ type: "alert_admin" }],
  },
  {
    name: "Require review for production AI",
    description:
      "Notify the asset owner when a production AI system has not been reviewed yet.",
    severity: "medium",
    conditions: {
      operator: "AND",
      rules: [
        { field: "environment", op: "eq", value: "production" },
        { field: "review_status", op: "neq", value: "reviewed" },
      ],
    },
    actions: [{ type: "alert_owner" }],
  },
  {
    name: "Flag sensitive data usage",
    description:
      "Flag and alert admins when AI systems handle PII or PHI data, supporting compliance oversight.",
    severity: "high",
    conditions: {
      operator: "OR",
      rules: [
        { field: "data_classification", op: "contains", value: "pii" },
        { field: "data_classification", op: "contains", value: "phi" },
      ],
    },
    actions: [{ type: "mark_flagged" }, { type: "alert_admin" }],
  },
];

function PolicyTemplateCards({
  title,
  onActivated,
}: {
  title: string;
  onActivated: () => void;
}) {
  const [activating, setActivating] = useState<string | null>(null);

  async function activate(template: PolicyTemplate) {
    setActivating(template.name);
    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          severity: template.severity,
          conditions: template.conditions,
          actions: template.actions,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Failed to activate policy");
        return;
      }

      toast.success(`"${template.name}" activated`);
      onActivated();
    } catch {
      toast.error("Failed to activate policy");
    } finally {
      setActivating(null);
    }
  }

  const SEVERITY_BADGE: Record<string, string> = {
    critical:
      "bg-destructive/10 text-destructive border-destructive/20",
    high: "bg-warning/10 text-warning border-warning/20",
    medium: "bg-info/10 text-info border-info/20",
    low: "bg-success/10 text-success border-success/20",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {POLICY_TEMPLATES.map((template) => (
          <div
            key={template.name}
            className="rounded-lg border border-border bg-card p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 min-w-0">
                <p className="text-[13px] font-medium leading-tight">
                  {template.name}
                </p>
                <span
                  className={cn(
                    "inline-flex h-5 items-center rounded-sm border px-1.5 text-[11px] font-medium capitalize",
                    SEVERITY_BADGE[template.severity] ?? "border-border text-muted-foreground",
                  )}
                >
                  {template.severity}
                </span>
              </div>
            </div>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              {template.description}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={activating === template.name}
              onClick={() => activate(template)}
            >
              {activating === template.name ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Activating...
                </>
              ) : (
                "Activate"
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

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
        <div className="space-y-6">
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
                  Create custom policy
                </Link>
              }
            />
          </div>
          <PolicyTemplateCards
            title="Recommended governance rules"
            onActivated={load}
          />
        </div>
      ) : (
        <>
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

        <PolicyTemplateCards
          title="Add more governance rules"
          onActivated={load}
        />
        </>
      )}
    </div>
  );
}
