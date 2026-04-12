"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft,
  CheckCircle2,
  UserPlus,
  ShieldOff,
  Clock,
  Tag,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Circle,
  Info,
} from "lucide-react";

const RISK_BADGE_CLASS: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/20",
  high:     "bg-warning/10 text-warning border-warning/20",
  medium:   "bg-info/10 text-info border-info/20",
  low:      "bg-success/10 text-success border-success/20",
};

const RISK_SCORE_TEXT: Record<string, string> = {
  critical: "text-destructive",
  high:     "text-warning",
  medium:   "text-info",
  low:      "text-success",
};

const OWNER_STATUS_LABELS: Record<string, string> = {
  active_owner:        "Active Owner",
  inactive_owner:      "Inactive Owner",
  unknown_owner:       "Unknown Owner",
  orphaned:            "No Owner",
  reassignment_pending:"Reassignment Pending",
  reviewed_unassigned: "Reviewed — Unassigned",
};

interface AssetData {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  source: string;
  source_url: string | null;
  environment: string;
  owner_email: string | null;
  owner_status: string;
  risk_level: string;
  risk_score: number;
  risk_breakdown: Record<string, { score: number; weight: number; explanation: string }>;
  ai_services: Array<{ provider: string; model?: string; purpose?: string }>;
  data_classification: string[];
  compliance_tags: string[];
  tags: string[];
  review_status: string;
  status: string;
  first_seen_at: string;
  last_seen_at: string;
  raw_metadata: Record<string, unknown> | null;
}

function generateWhyThisMatters(asset: AssetData): {
  headline: string;
  detail: string;
  severity: "critical" | "warning" | "info";
} {
  if (asset.risk_level === "critical" && asset.owner_status === "orphaned") {
    return {
      headline: "Critical risk with no owner",
      detail:
        "This AI system is high-risk and has no one accountable for it. If something goes wrong, there is no clear person to respond.",
      severity: "critical",
    };
  }
  if (asset.risk_level === "critical") {
    return {
      headline: "This system poses significant governance risk",
      detail:
        "Based on its environment, data access, and ownership status, this system requires immediate attention.",
      severity: "critical",
    };
  }
  if (asset.owner_status === "orphaned" && asset.environment === "production") {
    return {
      headline: "Production AI with no owner",
      detail:
        "This system is running in production with no one responsible for it. Any issues would go unnoticed.",
      severity: "critical",
    };
  }
  if (asset.owner_status === "orphaned") {
    return {
      headline: "No one is responsible for this AI system",
      detail:
        "Without a clear owner, this system can't be properly governed, updated, or responded to if issues arise.",
      severity: "warning",
    };
  }
  if (asset.risk_level === "high") {
    return {
      headline: "This system needs governance attention",
      detail:
        "Elevated risk factors were detected. Review the risk breakdown below and take appropriate action.",
      severity: "warning",
    };
  }
  const dcLower = asset.data_classification.map((d) => d.toLowerCase());
  if (
    asset.environment === "production" &&
    (dcLower.includes("pii") || dcLower.includes("phi"))
  ) {
    return {
      headline: "AI system handling sensitive data in production",
      detail:
        "This system may be processing personal or protected data. Ensure proper oversight and documentation.",
      severity: "warning",
    };
  }
  if (asset.kind === "agent") {
    return {
      headline: "Autonomous AI agent detected",
      detail:
        "Agent-type systems can take actions independently. Ensure appropriate guardrails and oversight are in place.",
      severity: "warning",
    };
  }
  return {
    headline: "AI system detected",
    detail:
      "Review the details below to understand this system's role and ensure proper governance.",
    severity: "info",
  };
}

const APPROVED_PROVIDERS = ["openai", "anthropic", "google", "azure"];

function generateActions(asset: AssetData): string[] {
  const actions: string[] = [];

  if (asset.owner_status === "orphaned" || asset.owner_status === "unknown_owner") {
    actions.push("Assign an owner who is accountable for this system");
  }
  if (asset.review_status !== "reviewed") {
    actions.push("Review this system and mark it as reviewed");
  }
  if (asset.risk_level === "critical" || asset.risk_level === "high") {
    actions.push(
      "Examine the risk breakdown and address the highest-scoring dimensions"
    );
  }
  const dcLower = asset.data_classification.map((d) => d.toLowerCase());
  if (
    asset.environment === "production" &&
    (dcLower.includes("pii") || dcLower.includes("phi") || dcLower.includes("financial"))
  ) {
    actions.push(
      "Verify that sensitive data handling has proper oversight and documentation"
    );
  }
  if (
    asset.ai_services.length > 0 &&
    asset.ai_services.some(
      (svc) => !APPROVED_PROVIDERS.includes(svc.provider.toLowerCase())
    )
  ) {
    actions.push(
      "Validate that this AI provider is approved for use in your organization"
    );
  }
  if (asset.kind === "agent") {
    actions.push(
      "Confirm that appropriate guardrails are in place for this autonomous system"
    );
  }
  if (actions.length < 3) {
    actions.push("Document the purpose and scope of this system");
  }

  return actions.slice(0, 3);
}

function getEvidenceSummary(asset: AssetData): {
  source: string;
  confidence: string;
  details: string[];
} {
  const rm = asset.raw_metadata ?? {};

  const SOURCE_MAP: Record<string, string> = {
    manifest: "Dependency manifest",
    "env-example": "Environment variable file",
    code: "Source code analysis",
  };
  const rawSource = typeof rm.source === "string" ? rm.source : "";
  const source = SOURCE_MAP[rawSource] ?? "Code scan";

  let confidence: string;
  if (typeof rm.confidence === "string") {
    confidence = rm.confidence;
  } else if (typeof rm.confidence === "number") {
    confidence = rm.confidence >= 80 ? "High" : rm.confidence >= 50 ? "Medium" : "Low";
  } else {
    confidence =
      asset.risk_score >= 80 ? "High" : asset.risk_score >= 50 ? "Medium" : "Low";
  }

  const details: string[] = [];
  if (typeof rm.filePath === "string") {
    details.push(`Found in: ${rm.filePath}`);
  }
  if (Array.isArray(rm.providers)) {
    details.push(`Providers: ${(rm.providers as string[]).join(", ")}`);
  }
  if (Array.isArray(rm.manifestPaths)) {
    details.push(`Manifests: ${(rm.manifestPaths as string[]).join(", ")}`);
  }

  return { source, confidence, details };
}

const SEVERITY_BORDER: Record<string, string> = {
  critical: "border-l-red-500",
  warning: "border-l-yellow-500",
  info: "border-l-blue-500",
};

const CONFIDENCE_BADGE: Record<string, string> = {
  High: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Low: "bg-muted text-muted-foreground border-border",
};

function MetadataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground shrink-0 w-36">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}

function formatDate(iso: string | null | undefined): React.ReactNode {
  if (!iso) return <span className="text-muted-foreground">—</span>;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return <span className="text-muted-foreground">—</span>;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AssetDetail({ asset: initialAsset }: { asset: AssetData }) {
  const [asset, setAsset] = useState(initialAsset);
  const [activeTab, setActiveTab] = useState("overview");
  const [actioning, setActioning] = useState<string | null>(null);

  async function markReviewed() {
    setActioning("review");
    try {
      const res = await fetch(`/api/assets/${asset.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_status: "reviewed" }),
      });
      if (!res.ok) throw new Error("Failed");
      setAsset((prev) => ({ ...prev, review_status: "reviewed" }));
      toast.success("Asset marked as reviewed");
    } catch {
      toast.error("Failed to update review status");
    } finally {
      setActioning(null);
    }
  }

  async function reassignOwner() {
    const email = window.prompt("Enter the new owner's email address:");
    if (!email?.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }
    setActioning("reassign");
    try {
      const res = await fetch(`/api/assets/${asset.id}/reassign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner_email: email.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      setAsset((prev) => ({ ...prev, owner_email: email.trim(), owner_status: "active_owner" }));
      toast.success(`Owner set to ${email.trim()}`);
    } catch {
      toast.error("Failed to reassign owner");
    } finally {
      setActioning(null);
    }
  }

  async function quarantine() {
    if (!window.confirm("Quarantine this asset? It will be flagged as quarantined and all related policies will be re-evaluated.")) return;
    setActioning("quarantine");
    try {
      const res = await fetch(`/api/assets/${asset.id}/quarantine`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Manual quarantine from asset detail" }),
      });
      if (!res.ok) throw new Error("Failed");
      setAsset((prev) => ({ ...prev, status: "quarantined" }));
      toast.success("Asset quarantined");
    } catch {
      toast.error("Failed to quarantine asset");
    } finally {
      setActioning(null);
    }
  }

  const isReviewed = asset.review_status === "reviewed";
  const isQuarantined = asset.status === "quarantined";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back nav */}
      <Link
        href="/platform/assets"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3" />
        Back to Asset Registry
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center rounded-sm px-2.5 py-1 text-xs font-semibold border capitalize ${RISK_BADGE_CLASS[asset.risk_level] ?? "border-border text-muted-foreground"}`}>
              {asset.risk_level} risk
            </span>
            <Badge variant="outline" className="capitalize">{asset.kind}</Badge>
            <Badge variant="outline" className="capitalize">{asset.source}</Badge>
            {isQuarantined && <Badge variant="destructive">Quarantined</Badge>}
            {isReviewed && <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Reviewed</Badge>}
          </div>
          <h1 className="text-2xl font-bold">{asset.name}</h1>
          {asset.description && <p className="text-sm text-muted-foreground">{asset.description}</p>}
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {!isReviewed && (
            <Button
              variant="outline"
              size="sm"
              onClick={markReviewed}
              disabled={actioning === "review"}
            >
              {actioning === "review"
                ? <RefreshCw className="size-4 animate-spin" />
                : <CheckCircle2 className="size-4" />}
              Mark reviewed
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={reassignOwner}
            disabled={!!actioning}
          >
            {actioning === "reassign"
              ? <RefreshCw className="size-4 animate-spin" />
              : <UserPlus className="size-4" />}
            Assign owner
          </Button>
          {!isQuarantined && (
            <Button
              variant="destructive"
              size="sm"
              onClick={quarantine}
              disabled={!!actioning}
            >
              {actioning === "quarantine"
                ? <RefreshCw className="size-4 animate-spin" />
                : <ShieldOff className="size-4" />}
              Quarantine
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-4 pt-2">
          {/* Why this matters */}
          {(() => {
            const wtm = generateWhyThisMatters(asset);
            return (
              <Card
                className={`border-l-4 ${SEVERITY_BORDER[wtm.severity] ?? "border-l-blue-500"}`}
              >
                <CardContent className="py-4">
                  <p className="font-bold text-sm">{wtm.headline}</p>
                  <p className="text-sm text-muted-foreground mt-1">{wtm.detail}</p>
                </CardContent>
              </Card>
            );
          })()}

          {/* What you should do */}
          {(() => {
            const actions = generateActions(asset);
            return (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">What you should do</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {actions.map((action, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Circle className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
                      <span className="text-sm">{action}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })()}

          {/* Detection evidence */}
          {(() => {
            const evidence = getEvidenceSummary(asset);
            return (
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Info className="size-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">
                      Detected via: {evidence.source}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        CONFIDENCE_BADGE[evidence.confidence] ?? CONFIDENCE_BADGE.Low
                      }
                    >
                      {evidence.confidence} confidence
                    </Badge>
                  </div>
                  {evidence.details.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {evidence.details.map((d, i) => (
                        <li key={i} className="text-xs text-muted-foreground">
                          {d}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Core details */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Asset Details</CardTitle></CardHeader>
              <CardContent className="space-y-0">
                <MetadataRow label="Environment" value={<span className="capitalize">{asset.environment}</span>} />
                <MetadataRow label="Kind" value={<span className="capitalize">{asset.kind}</span>} />
                <MetadataRow label="Source" value={<span className="capitalize">{asset.source}</span>} />
                <MetadataRow label="Review status" value={
                  <span className="capitalize">{asset.review_status.replace(/_/g, " ")}</span>
                } />
                <MetadataRow label="First seen" value={formatDate(asset.first_seen_at)} />
                <MetadataRow label="Last seen" value={formatDate(asset.last_seen_at)} />
                {asset.source_url && (
                  <MetadataRow label="Source link" value={
                    <a href={asset.source_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline">
                      View source <ExternalLink className="size-3" />
                    </a>
                  } />
                )}
              </CardContent>
            </Card>

            {/* Ownership */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Ownership</CardTitle></CardHeader>
              <CardContent className="space-y-0">
                <MetadataRow label="Status" value={
                  <span className={`font-medium ${
                    asset.owner_status === "orphaned" ? "text-red-600" :
                    asset.owner_status === "inactive_owner" ? "text-orange-600" :
                    asset.owner_status === "active_owner" ? "text-emerald-600" : ""
                  }`}>
                    {OWNER_STATUS_LABELS[asset.owner_status] ?? asset.owner_status}
                  </span>
                } />
                <MetadataRow label="Owner" value={
                  asset.owner_email ? (
                    <a href={`mailto:${asset.owner_email}`} className="text-primary hover:underline">
                      {asset.owner_email}
                    </a>
                  ) : (
                    <span className="text-muted-foreground italic">Not assigned</span>
                  )
                } />
              </CardContent>
            </Card>

            {/* AI Services */}
            {asset.ai_services.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">AI Services Detected</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {asset.ai_services.map((svc, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium capitalize">{svc.provider}</p>
                          {svc.model && <p className="text-xs text-muted-foreground">Model: {svc.model}</p>}
                          {svc.purpose && <p className="text-xs text-muted-foreground">{svc.purpose}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tags & Classification */}
            {(asset.data_classification.length > 0 || asset.tags.length > 0) && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Tags & Classification</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {asset.data_classification.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {asset.data_classification.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          <Tag className="mr-1 size-3" />{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {asset.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {asset.tags.map((tag) => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Risk ── */}
        <TabsContent value="risk" className="pt-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Risk Score Breakdown</CardTitle>
                <span className={`text-2xl font-bold nx-tabular ${RISK_SCORE_TEXT[asset.risk_level] ?? "text-muted-foreground"}`}>
                  {asset.risk_score}/100
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {Object.keys(asset.risk_breakdown).length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <AlertTriangle className="size-4" />
                  <p>Risk breakdown will appear after the next sync.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(asset.risk_breakdown).map(([dimension, detail]) => (
                    <div key={dimension} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize font-medium">{dimension.replace(/_/g, " ")}</span>
                        <span className="text-muted-foreground tabular-nums">{detail.score}/{Math.round(detail.weight * 100)}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${detail.score > 70 ? "bg-red-500" : detail.score > 40 ? "bg-orange-400" : "bg-emerald-500"}`}
                          style={{ width: `${detail.weight > 0 ? Math.min((detail.score / 100) * 100, 100) : 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{detail.explanation}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Compliance ── */}
        <TabsContent value="compliance" className="pt-2">
          <Card>
            <CardHeader><CardTitle className="text-sm">Compliance Relevance</CardTitle></CardHeader>
            <CardContent>
              {asset.compliance_tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No compliance frameworks mapped to this asset. Run a policy evaluation to populate this.
                </p>
              ) : (
                <div className="space-y-3">
                  {asset.compliance_tags.map((tag) => (
                    <div key={tag} className="flex items-center gap-3 rounded-lg border p-3">
                      <Badge variant="secondary">{tag}</Badge>
                      <p className="text-sm text-muted-foreground">
                        {tag === "HIPAA" && "This asset may involve protected health data. Verify oversight documentation with your compliance team."}
                        {tag === "SOC2" && "This asset should be included in your SOC 2 AI system inventory."}
                        {tag === "EU_AI_ACT" && "Review documentation requirements under EU AI Act Articles 9–17."}
                        {tag === "ISO42001" && "Ensure governance documentation meets ISO/IEC 42001 control requirements."}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Metadata ── */}
        <TabsContent value="metadata" className="pt-2">
          <Card>
            <CardHeader><CardTitle className="text-sm">Raw Metadata</CardTitle></CardHeader>
            <CardContent>
              {!asset.raw_metadata || Object.keys(asset.raw_metadata).length === 0 ? (
                <p className="text-sm text-muted-foreground">No additional metadata available.</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(asset.raw_metadata).map(([key, val]) => (
                    <div key={key} className="flex items-start gap-3 py-1.5 border-b last:border-0">
                      <span className="text-xs font-mono text-muted-foreground w-40 shrink-0 pt-0.5">{key}</span>
                      <span className="text-xs break-all">
                        {typeof val === "object" ? JSON.stringify(val) : String(val ?? "")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
