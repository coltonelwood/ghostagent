"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Play, Trash2, Loader2, CheckCircle2, EyeOff, RotateCcw, ToggleLeft, ToggleRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Policy, PolicyViolation, PolicyRule, PolicyConditionGroup, PolicyAction } from "@/lib/types/platform";

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high:     "bg-orange-100 text-orange-800 border-orange-200",
  medium:   "bg-yellow-100 text-yellow-800 border-yellow-200",
  low:      "bg-green-100 text-green-800 border-green-200",
  info:     "bg-blue-100 text-blue-700 border-blue-200",
};

const STATUS_VARIANT: Record<string, "destructive" | "secondary" | "outline"> = {
  open: "destructive",
  acknowledged: "outline",
  resolved: "secondary",
  suppressed: "secondary",
};

const ACTION_LABELS: Record<string, string> = {
  alert_owner:   "Alert owner",
  alert_admin:   "Alert admins",
  alert_slack:   "Notify Slack",
  alert_webhook: "Fire webhook",
  create_task:   "Create task",
  mark_flagged:  "Flag for review",
  quarantine:    "Quarantine asset",
};

const OP_LABELS: Record<string, string> = {
  eq: "=",  neq: "≠",  gt: ">",  lt: "<",  gte: "≥",  lte: "≤",
  contains: "contains",  not_contains: "doesn't contain",
  is_null: "is empty",  is_not_null: "is set",
  in: "is one of",  not_in: "is not one of",
};

function RuleText({ rule }: { rule: PolicyRule }) {
  const val = rule.op === "is_null" || rule.op === "is_not_null" ? null : rule.value;
  return (
    <span className="text-sm">
      <span className="font-mono text-muted-foreground text-xs bg-muted px-1.5 py-0.5 rounded mr-1.5">
        {rule.field.replace(/_/g, " ")}
      </span>
      <span className="text-muted-foreground">{OP_LABELS[rule.op] ?? rule.op}</span>
      {val !== null && val !== undefined && (
        <span className="font-medium ml-1.5">
          {Array.isArray(val) ? val.join(", ") : String(val)}
        </span>
      )}
    </span>
  );
}

function ConditionSummary({ conditions }: { conditions: PolicyConditionGroup }) {
  const rules = conditions.rules as Array<PolicyRule | PolicyConditionGroup>;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Match {conditions.operator === "AND" ? "ALL of" : "ANY of"}:
      </p>
      <div className="space-y-1">
        {rules.map((r, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-xs text-muted-foreground mt-0.5">•</span>
            {"operator" in r
              ? <span className="text-sm text-muted-foreground italic">Group ({(r as PolicyConditionGroup).operator})</span>
              : <RuleText rule={r as PolicyRule} />
            }
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [violations, setViolations] = useState<PolicyViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [running, setRunning] = useState(false);
  const [updatingViolation, setUpdatingViolation] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([
      fetch(`/api/policies/${id}`).then((r) => r.json()),
      fetch(`/api/policies/${id}/violations?pageSize=50`).then((r) => r.json()),
    ]).then(([pData, vData]) => {
      // API returns policy fields at top level of data (not nested under 'policy')
      const p = pData.data;
      if (p && !p.policy) setPolicy(p as unknown as Policy);
      else if (p?.policy) setPolicy(p.policy);
      setViolations(vData.data ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  async function toggleEnabled() {
    if (!policy) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/policies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !policy.enabled }),
      });
      if (!res.ok) throw new Error("Failed");
      setPolicy({ ...policy, enabled: !policy.enabled });
      toast.success(policy.enabled ? "Policy disabled" : "Policy enabled");
    } catch {
      toast.error("Failed to update policy");
    } finally {
      setToggling(false);
    }
  }

  async function runPolicy() {
    setRunning(true);
    try {
      const res = await fetch(`/api/policies/${id}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const v = data.data?.violations_found ?? 0;
      toast.success(v > 0 ? `${v} violation${v !== 1 ? "s" : ""} found` : "No violations found");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to run policy");
    } finally {
      setRunning(false);
    }
  }

  async function deletePolicy() {
    if (!confirm("Delete this policy? All violations will also be removed.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/policies/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Policy deleted");
      router.push("/platform/policies");
    } catch {
      toast.error("Failed to delete policy");
      setDeleting(false);
    }
  }

  async function updateViolationStatus(violationId: string, status: "open" | "acknowledged" | "resolved" | "suppressed") {
    setUpdatingViolation(violationId);
    try {
      const res = await fetch(`/api/policies/${id}/violations/${violationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      setViolations((prev) => prev.map((v) => (v.id === violationId ? { ...v, status } : v)));
    } catch {
      toast.error("Failed to update violation");
    } finally {
      setUpdatingViolation(null);
    }
  }

  if (loading || !policy) {
    return (
      <div className="p-8 space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
      </div>
    );
  }

  const openCount = violations.filter((v) => v.status === "open").length;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">

      {/* Back */}
      <Link href="/platform/policies" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to Policies
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-2xl font-bold">{policy.name}</h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${SEVERITY_BADGE[policy.severity] ?? ""}`}>
              {policy.severity}
            </span>
            {!policy.enabled && <Badge variant="secondary">Disabled</Badge>}
            {policy.dry_run_mode && <Badge variant="outline">Dry Run Mode</Badge>}
          </div>
          {policy.description && <p className="text-muted-foreground text-sm">{policy.description}</p>}
          {policy.last_run_at && (
            <p className="text-xs text-muted-foreground mt-1">
              Last evaluated {timeAgo(policy.last_run_at)}
              {policy.last_run_violations != null && ` · ${policy.last_run_violations} violation${policy.last_run_violations !== 1 ? "s" : ""}`}
            </p>
          )}
        </div>

        <div className="flex gap-2 flex-wrap shrink-0">
          <Button size="sm" variant="outline" onClick={runPolicy} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="h-4 w-4 mr-1.5" />Run now</>}
          </Button>
          <Button size="sm" variant="outline" onClick={toggleEnabled} disabled={toggling}>
            {toggling ? <Loader2 className="h-4 w-4 animate-spin" />
              : policy.enabled
                ? <><ToggleLeft className="h-4 w-4 mr-1.5" />Disable</>
                : <><ToggleRight className="h-4 w-4 mr-1.5" />Enable</>}
          </Button>
          <Button size="sm" variant="outline" onClick={deletePolicy} disabled={deleting} className="text-destructive hover:text-destructive">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Policy config */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Conditions */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Conditions</CardTitle></CardHeader>
          <CardContent>
            <ConditionSummary conditions={policy.conditions} />
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Actions When Triggered</CardTitle></CardHeader>
          <CardContent>
            {(!policy.actions || policy.actions.length === 0) ? (
              <p className="text-sm text-muted-foreground">No actions configured. Policy records violations only.</p>
            ) : (
              <div className="space-y-1.5">
                {(policy.actions as PolicyAction[]).map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    <span className="text-sm">{ACTION_LABELS[a.type] ?? a.type}</span>
                    {a.config?.value != null && (
                      <span className="text-xs text-muted-foreground font-mono truncate">
                        ({String(a.config.value as string)})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Violations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              Violations
              {openCount > 0 && <span className="ml-2 text-xs font-normal text-destructive">({openCount} open)</span>}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {violations.length === 0 ? (
            <div className="text-center py-8 space-y-1">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
              <p className="text-sm text-muted-foreground">No violations detected</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detected</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {violations.map((v) => {
                  const assetData = v.asset as unknown as { id: string; name: string } | null;
                  return (
                    <TableRow key={v.id}>
                      <TableCell>
                        {assetData ? (
                          <Link href={`/platform/assets/${v.asset_id}`} className="text-sm font-medium hover:underline">
                            {assetData.name}
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground font-mono">Asset {v.asset_id?.slice(0, 8)}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[v.status] ?? "secondary"} className="capitalize text-xs">
                          {v.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{timeAgo(v.first_detected_at)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-0.5">
                          {v.status === "open" && (
                            <>
                              <Button size="sm" variant="ghost" title="Acknowledge" disabled={updatingViolation === v.id}
                                onClick={() => updateViolationStatus(v.id, "acknowledged")}>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" title="Resolve" disabled={updatingViolation === v.id}
                                onClick={() => updateViolationStatus(v.id, "resolved")}>
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" title="Suppress" disabled={updatingViolation === v.id}
                                onClick={() => updateViolationStatus(v.id, "suppressed")}>
                                <EyeOff className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {v.status === "acknowledged" && (
                            <Button size="sm" variant="ghost" title="Resolve" disabled={updatingViolation === v.id}
                              onClick={() => updateViolationStatus(v.id, "resolved")}>
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {(v.status === "resolved" || v.status === "suppressed") && (
                            <Button size="sm" variant="ghost" title="Reopen" disabled={updatingViolation === v.id}
                              onClick={() => updateViolationStatus(v.id, "open")}>
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {updatingViolation === v.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-1" />}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
