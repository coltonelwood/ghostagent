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
} from "lucide-react";

const RISK_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high:     "bg-orange-100 text-orange-800 border-orange-200",
  medium:   "bg-yellow-100 text-yellow-800 border-yellow-200",
  low:      "bg-green-100 text-green-800 border-green-200",
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

function MetadataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground shrink-0 w-36">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
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
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border capitalize ${RISK_COLORS[asset.risk_level] ?? ""}`}>
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
                <MetadataRow label="First seen" value={
                  new Date(asset.first_seen_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                } />
                <MetadataRow label="Last seen" value={
                  new Date(asset.last_seen_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                } />
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
                <span className={`text-2xl font-bold ${RISK_COLORS[asset.risk_level] ? "text-" + asset.risk_level + "-600" : ""}`}>
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
                        {tag === "HIPAA" && "This asset may involve patient data. Verify oversight documentation."}
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
