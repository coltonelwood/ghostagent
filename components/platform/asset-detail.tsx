"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Eye,
  UserPlus,
  ShieldOff,
  Clock,
  Tag,
  ExternalLink,
} from "lucide-react";

const RISK_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const OWNER_STATUS_LABELS: Record<string, string> = {
  active_owner: "Active Owner",
  inactive_owner: "Inactive Owner",
  unknown_owner: "Unknown Owner",
  orphaned: "Orphaned",
  reassignment_pending: "Reassignment Pending",
  reviewed_unassigned: "Reviewed (Unassigned)",
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
  tags: string[];
  compliance_tags: string[];
  status: string;
  review_status: string;
  first_seen_at: string;
  last_seen_at: string;
  last_changed_at: string;
  created_at: string;
  raw_metadata?: Record<string, unknown>;
}

function MetadataRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-2 border-b last:border-0">
      <span className="w-36 shrink-0 text-sm text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

export function AssetDetail({ asset }: { asset: AssetData }) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link
            href="/platform/assets"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            Back to Asset Registry
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{asset.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{asset.source}</Badge>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${RISK_COLORS[asset.risk_level] ?? ""}`}
            >
              {asset.risk_level} ({asset.risk_score})
            </span>
            <Badge
              variant={
                asset.owner_status === "orphaned" ? "destructive" : "outline"
              }
            >
              {OWNER_STATUS_LABELS[asset.owner_status] ?? asset.owner_status}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {asset.status}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Eye className="size-4" />
            Review
          </Button>
          <Button variant="outline" size="sm">
            <UserPlus className="size-4" />
            Reassign
          </Button>
          <Button variant="destructive" size="sm">
            <ShieldOff className="size-4" />
            Quarantine
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
              </CardHeader>
              <CardContent>
                <MetadataRow label="Kind" value={<span className="capitalize">{asset.kind}</span>} />
                <MetadataRow label="Environment" value={<span className="capitalize">{asset.environment}</span>} />
                <MetadataRow label="Owner" value={asset.owner_email ?? "No owner assigned"} />
                <MetadataRow label="Review Status" value={<span className="capitalize">{asset.review_status.replace("_", " ")}</span>} />
                <MetadataRow label="First Seen" value={new Date(asset.first_seen_at).toLocaleDateString()} />
                <MetadataRow label="Last Seen" value={new Date(asset.last_seen_at).toLocaleDateString()} />
                <MetadataRow label="Last Changed" value={new Date(asset.last_changed_at).toLocaleDateString()} />
                {asset.source_url && (
                  <MetadataRow
                    label="Source URL"
                    value={
                      <a
                        href={asset.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        View source <ExternalLink className="size-3" />
                      </a>
                    }
                  />
                )}
                {asset.description && (
                  <MetadataRow label="Description" value={asset.description} />
                )}
              </CardContent>
            </Card>

            {/* AI Services */}
            <Card>
              <CardHeader>
                <CardTitle>AI Services</CardTitle>
              </CardHeader>
              <CardContent>
                {asset.ai_services.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No AI services detected.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {asset.ai_services.map((svc, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-lg border p-3"
                      >
                        <div>
                          <p className="text-sm font-medium capitalize">
                            {svc.provider}
                          </p>
                          {svc.model && (
                            <p className="text-xs text-muted-foreground">
                              Model: {svc.model}
                            </p>
                          )}
                          {svc.purpose && (
                            <p className="text-xs text-muted-foreground">
                              {svc.purpose}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Data Classification */}
            <Card>
              <CardHeader>
                <CardTitle>Data Classification</CardTitle>
              </CardHeader>
              <CardContent>
                {asset.data_classification.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No data classification tags.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {asset.data_classification.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        <Tag className="mr-1 size-3" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Risk Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Risk Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(asset.risk_breakdown).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No risk breakdown available.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(asset.risk_breakdown).map(
                      ([dimension, detail]) => (
                        <div key={dimension} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="capitalize">
                              {dimension.replace(/_/g, " ")}
                            </span>
                            <span className="font-medium">
                              {detail.score}/{detail.weight}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{
                                width: `${detail.weight > 0 ? (detail.score / detail.weight) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {detail.explanation}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Raw Metadata */}
            {asset.raw_metadata &&
              Object.keys(asset.raw_metadata).length > 0 && (
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Raw Metadata</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-4 text-xs">
                      {JSON.stringify(asset.raw_metadata, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Change History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="size-4" />
                <p>
                  Change history will be populated as the asset is synced and
                  updated over time.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Events</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Events related to this asset will appear here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Mapping</CardTitle>
            </CardHeader>
            <CardContent>
              {asset.compliance_tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No compliance frameworks mapped to this asset yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {asset.compliance_tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No tasks assigned to this asset.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
