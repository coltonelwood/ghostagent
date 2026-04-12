"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Zap,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Undo2,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface Prediction {
  id: string;
  threat_type: string;
  severity: "critical" | "high" | "medium" | "low";
  score: number;
  description: string;
  predicted_at: string;
}

interface Countermeasure {
  id: string;
  name: string;
  status: "active" | "deploying" | "rolled_back" | "failed";
  prediction_id: string;
  deployed_at: string;
  description: string;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const severityVariant = (
  severity: string,
): "default" | "destructive" | "secondary" | "outline" => {
  switch (severity) {
    case "critical":
    case "high":
      return "destructive";
    case "medium":
      return "secondary";
    default:
      return "outline";
  }
};

const statusVariant = (
  status: string,
): "default" | "destructive" | "secondary" | "outline" => {
  switch (status) {
    case "active":
      return "default";
    case "deploying":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
};

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

export function ImmunityDashboard() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [countermeasures, setCountermeasures] = useState<Countermeasure[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [predictionsRes, countermeasuresRes] = await Promise.all([
        fetch("/api/immunity/predictions"),
        fetch("/api/immunity/countermeasures"),
      ]);

      if (predictionsRes.ok) {
        const json = await predictionsRes.json();
        setPredictions(json.data ?? []);
      }

      if (countermeasuresRes.ok) {
        const json = await countermeasuresRes.json();
        setCountermeasures(json.data ?? []);
      }
    } catch {
      toast.error("Failed to load immunity data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function deployCountermeasure(predictionId: string) {
    setDeploying(predictionId);
    try {
      const res = await fetch("/api/immunity/countermeasures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prediction_id: predictionId }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setCountermeasures((prev) => [json.data, ...prev]);
        }
        toast.success("Countermeasure deployed successfully");
      } else {
        const json = await res.json();
        toast.error(json.error ?? "Failed to deploy countermeasure");
      }
    } catch {
      toast.error("Failed to deploy countermeasure");
    } finally {
      setDeploying(null);
    }
  }

  async function rollbackCountermeasure(countermeasureId: string) {
    setRollingBack(countermeasureId);
    try {
      const res = await fetch(
        `/api/immunity/countermeasures/${countermeasureId}/rollback`,
        { method: "POST" },
      );
      if (res.ok) {
        setCountermeasures((prev) =>
          prev.map((c) =>
            c.id === countermeasureId ? { ...c, status: "rolled_back" } : c,
          ),
        );
        toast.success("Countermeasure rolled back");
      } else {
        toast.error("Failed to rollback countermeasure");
      }
    } catch {
      toast.error("Failed to rollback countermeasure");
    } finally {
      setRollingBack(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-border bg-muted/30"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl border border-border bg-muted/30" />
      </div>
    );
  }

  const activePredictions = predictions.length;
  const activeCountermeasures = countermeasures.filter(
    (c) => c.status === "active",
  ).length;
  const criticalPredictions = predictions.filter(
    (p) => p.severity === "critical" || p.severity === "high",
  ).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Active Predictions"
          value={activePredictions}
          icon={AlertTriangle}
          tone={criticalPredictions > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Active Countermeasures"
          value={activeCountermeasures}
          icon={Shield}
          tone="success"
        />
        <StatCard
          label="Critical / High"
          value={criticalPredictions}
          icon={Zap}
          tone={criticalPredictions > 0 ? "danger" : "neutral"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Predictions */}
        <Card>
          <CardHeader>
            <CardTitle>Active Predictions</CardTitle>
            <CardDescription>
              Threats predicted by the behavioral genome analysis engine.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {predictions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="size-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  No active predictions
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  The behavioral genome has not identified any imminent threats.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {predictions.map((prediction) => {
                  const isDeploying = deploying === prediction.id;
                  const hasCountermeasure = countermeasures.some(
                    (c) =>
                      c.prediction_id === prediction.id &&
                      (c.status === "active" || c.status === "deploying"),
                  );

                  return (
                    <div
                      key={prediction.id}
                      className="rounded-lg border border-border p-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              {prediction.threat_type}
                            </p>
                            <Badge
                              variant={severityVariant(prediction.severity)}
                            >
                              {prediction.severity}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {prediction.description}
                          </p>
                          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="nx-tabular">
                              Score: {prediction.score}%
                            </span>
                            <span>&middot;</span>
                            <span>{timeAgo(prediction.predicted_at)}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={hasCountermeasure ? "outline" : "default"}
                          disabled={isDeploying || hasCountermeasure}
                          onClick={() =>
                            deployCountermeasure(prediction.id)
                          }
                        >
                          {isDeploying ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Rocket className="size-3.5" />
                          )}
                          {hasCountermeasure ? "Deployed" : "Deploy"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Countermeasures */}
        <Card>
          <CardHeader>
            <CardTitle>Deployed Countermeasures</CardTitle>
            <CardDescription>
              Active defenses deployed in response to predicted threats.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {countermeasures.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Shield className="size-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  No countermeasures deployed
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Deploy countermeasures from the predictions panel to protect
                  your environment.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {countermeasures.map((cm) => {
                  const isRollingBack = rollingBack === cm.id;
                  const canRollback =
                    cm.status === "active" || cm.status === "deploying";

                  return (
                    <div
                      key={cm.id}
                      className="rounded-lg border border-border p-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              {cm.name}
                            </p>
                            <Badge variant={statusVariant(cm.status)}>
                              {cm.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {cm.description}
                          </p>
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            Deployed {timeAgo(cm.deployed_at)}
                          </p>
                        </div>
                        {canRollback && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isRollingBack}
                            onClick={() => rollbackCountermeasure(cm.id)}
                          >
                            {isRollingBack ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Undo2 className="size-3.5" />
                            )}
                            Rollback
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
