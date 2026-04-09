"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { LinkButton } from "@/components/ui/link-button";
import { ArrowLeft, Play, Pencil, Trash2, Loader2, CheckCircle2, EyeOff, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RiskBadge } from "@/components/platform/risk-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Policy, PolicyViolation } from "@/lib/types/platform";

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const STATUS_VARIANT: Record<string, "destructive" | "secondary" | "outline"> = {
  open: "destructive",
  acknowledged: "outline",
  resolved: "secondary",
  suppressed: "secondary",
};

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
    Promise.all([fetch(`/api/policies/${id}`).then((r) => r.json())]).then(
      ([pData]) => {
        setPolicy(pData.data?.policy);
        setViolations(pData.data?.violations ?? []);
        setLoading(false);
      }
    );
  }

  useEffect(() => {
    load();
  }, [id]);

  async function toggleEnabled() {
    if (!policy) return;
    setToggling(true);
    await fetch(`/api/policies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !policy.enabled }),
    });
    setPolicy({ ...policy, enabled: !policy.enabled });
    setToggling(false);
  }

  async function runPolicy() {
    setRunning(true);
    try {
      await fetch(`/api/policies/${id}/run`, { method: "POST" });
      load();
    } finally {
      setRunning(false);
    }
  }

  async function deletePolicy() {
    if (!confirm("Delete this policy? All violations will also be removed.")) return;
    setDeleting(true);
    await fetch(`/api/policies/${id}`, { method: "DELETE" });
    router.push("/platform/policies");
  }

  async function updateViolationStatus(violationId: string, status: "open" | "acknowledged" | "resolved" | "suppressed") {
    setUpdatingViolation(violationId);
    try {
      await fetch(`/api/policies/${id}/violations/${violationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setViolations((prev) =>
        prev.map((v) => (v.id === violationId ? { ...v, status } : v))
      );
    } finally {
      setUpdatingViolation(null);
    }
  }

  if (loading || !policy) {
    return (
      <div className="p-8">
        <div className="h-96 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <Link
          href="/platform/policies"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Policies
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{policy.name}</h1>
              <RiskBadge
                level={
                  ["critical", "high"].includes(policy.severity)
                    ? (policy.severity as "critical" | "high")
                    : policy.severity === "medium"
                      ? "medium"
                      : "low"
                }
              />
              {!policy.enabled && <Badge variant="secondary">Disabled</Badge>}
              {policy.dry_run_mode && <Badge variant="outline">Dry Run</Badge>}
            </div>
            {policy.description && (
              <p className="text-muted-foreground mt-1">{policy.description}</p>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={runPolicy} disabled={running}>
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <><Play className="h-4 w-4 mr-1.5" />Run</>
              )}
            </Button>
            <LinkButton href={`/platform/policies/new?from=${id}`} size="sm" variant="outline">
              <Pencil className="h-4 w-4 mr-1.5" />Edit
            </LinkButton>
            <Button
              size="sm"
              variant="outline"
              onClick={toggleEnabled}
              disabled={toggling}
            >
              {toggling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : policy.enabled ? (
                "Disable"
              ) : (
                "Enable"
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={deletePolicy}
              disabled={deleting}
              className="text-destructive hover:text-destructive"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Policy config summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Policy Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded-lg p-3">
            <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(policy.conditions, null, 2)}
            </pre>
          </div>
          {policy.last_run_at && (
            <p className="text-xs text-muted-foreground mt-3">
              Last run {timeAgo(policy.last_run_at)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Violations table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              Violations ({violations.filter((v) => v.status === "open").length} open)
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {violations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No violations detected
            </p>
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
                {violations.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      {v.asset ? (
                        <Link
                          href={`/platform/assets/${v.asset_id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {v.asset.name}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium">
                          Asset #{v.asset_id?.slice(0, 8)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_VARIANT[v.status] ?? "secondary"}
                        className="capitalize"
                      >
                        {v.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(v.first_detected_at)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {v.status === "open" && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Acknowledge"
                              disabled={updatingViolation === v.id}
                              onClick={() => updateViolationStatus(v.id, "acknowledged")}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Resolve"
                              disabled={updatingViolation === v.id}
                              onClick={() => updateViolationStatus(v.id, "resolved")}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Suppress"
                              disabled={updatingViolation === v.id}
                              onClick={() => updateViolationStatus(v.id, "suppressed")}
                            >
                              <EyeOff className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {v.status === "acknowledged" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Resolve"
                            disabled={updatingViolation === v.id}
                            onClick={() => updateViolationStatus(v.id, "resolved")}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {(v.status === "resolved" || v.status === "suppressed") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Reopen"
                            disabled={updatingViolation === v.id}
                            onClick={() => updateViolationStatus(v.id, "open")}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {updatingViolation === v.id && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        )}
                      </div>
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
