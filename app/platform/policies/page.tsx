"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Shield, Play, Pencil, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
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
import type { Policy } from "@/lib/types/platform";

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function PoliciesPage() {
  const router = useRouter();
  const [policies, setPolicies] = useState<(Policy & { policy_violations?: [{ count: number }] })[]>([]);
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

  useEffect(() => { load(); }, []);

  async function runPolicy(policyId: string) {
    setRunning(policyId);
    try {
      await fetch(`/api/policies/${policyId}/run`, { method: "POST" });
      load();
    } finally {
      setRunning(null);
    }
  }

  async function toggleEnabled(policy: Policy) {
    setToggling(policy.id);
    try {
      await fetch(`/api/policies/${policy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !policy.enabled }),
      });
      setPolicies((prev) =>
        prev.map((p) => (p.id === policy.id ? { ...p, enabled: !p.enabled } : p))
      );
    } finally {
      setToggling(null);
    }
  }

  async function deletePolicy(policyId: string) {
    if (!confirm("Delete this policy? All violations will also be removed.")) return;
    setDeleting(policyId);
    try {
      await fetch(`/api/policies/${policyId}`, { method: "DELETE" });
      setPolicies((prev) => prev.filter((p) => p.id !== policyId));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Policies</h1>
          <p className="text-muted-foreground mt-1">Define rules that detect and alert on AI governance issues</p>
        </div>
        <LinkButton href="/platform/policies/new">
          <Plus className="h-4 w-4 mr-1.5" />
          New Policy
        </LinkButton>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : policies.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-semibold mb-1">No policies yet</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
            Create policies to automatically detect orphaned agents, high-risk systems, and compliance gaps.
          </p>
          <LinkButton href="/platform/policies/new">
            <Plus className="h-4 w-4 mr-1.5" />
            Create your first policy
          </LinkButton>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="text-center">Enabled</TableHead>
                  <TableHead className="text-right">Violations</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy) => {
                  const violationCount =
                    policy.policy_violations?.[0]?.count ?? policy.last_run_violations ?? 0;
                  return (
                    <TableRow key={policy.id}>
                      <TableCell>
                        <Link
                          href={`/platform/policies/${policy.id}`}
                          className="font-medium hover:underline"
                        >
                          {policy.name}
                        </Link>
                        {policy.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">
                            {policy.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <RiskBadge
                          level={
                            policy.severity === "critical" || policy.severity === "high"
                              ? policy.severity
                              : policy.severity === "medium"
                                ? "medium"
                                : "low"
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          onClick={() => toggleEnabled(policy)}
                          disabled={toggling === policy.id}
                          className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          style={{
                            backgroundColor: policy.enabled
                              ? "hsl(var(--primary))"
                              : "hsl(var(--muted))",
                          }}
                          aria-label={policy.enabled ? "Disable policy" : "Enable policy"}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                              policy.enabled ? "translate-x-[18px]" : "translate-x-[3px]"
                            }`}
                          />
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        {violationCount > 0 ? (
                          <Badge variant="destructive" className="text-xs">
                            {violationCount}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {policy.last_run_at ? (
                          <span className="text-xs text-muted-foreground">
                            {timeAgo(policy.last_run_at)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push(`/platform/policies/${policy.id}`)}
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => runPolicy(policy.id)}
                            disabled={running === policy.id}
                            title="Run now"
                          >
                            {running === policy.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Play className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deletePolicy(policy.id)}
                            disabled={deleting === policy.id}
                            title="Delete"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            {deleting === policy.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
