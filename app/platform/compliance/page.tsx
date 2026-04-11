"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Download,
  Clock,
  ArrowRight,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

// --------------------------------------------------------------------------
// Framework definitions
// --------------------------------------------------------------------------

const FRAMEWORKS = [
  {
    code: "eu_ai_act",
    name: "EU AI Act",
    description: "European Union AI regulation effective August 2026",
    abbr: "EU",
  },
  {
    code: "soc2_ai",
    name: "SOC 2 AI Controls",
    description: "SOC 2 controls relevant to AI systems",
    abbr: "S2",
  },
  {
    code: "iso42001",
    name: "ISO/IEC 42001",
    description: "International AI management system standard",
    abbr: "ISO",
  },
  {
    code: "nist_ai_rmf",
    name: "NIST AI RMF",
    description: "NIST AI Risk Management Framework",
    abbr: "RMF",
  },
];

interface FrameworkData {
  code: string;
  score: number;
  total_controls: number;
  compliant_controls: number;
  non_compliant_controls: number;
}

interface GapData {
  framework: string;
  control_id: string;
  control_name: string;
  status: string;
  asset_count: number;
}

interface ComplianceData {
  overall_score: number;
  frameworks: FrameworkData[];
  top_gaps: GapData[];
}

// --------------------------------------------------------------------------
// Components
// --------------------------------------------------------------------------

function ScoreColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warning";
  if (score > 0) return "text-destructive";
  return "text-muted-foreground";
}

function ScoreBarColor(score: number): string {
  if (score >= 80) return "bg-success";
  if (score >= 50) return "bg-warning";
  if (score > 0) return "bg-destructive";
  return "bg-muted-foreground/30";
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "compliant":
      return <CheckCircle2 className="size-3.5 text-success" />;
    case "non_compliant":
      return <XCircle className="size-3.5 text-destructive" />;
    case "needs_review":
      return <AlertCircle className="size-3.5 text-warning" />;
    default:
      return <HelpCircle className="size-3.5 text-muted-foreground" />;
  }
}

// --------------------------------------------------------------------------
// Page
// --------------------------------------------------------------------------

export default function CompliancePage() {
  const [data, setData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/compliance")
      .then((r) => r.json())
      .then((d) => {
        const raw = d.data;
        if (!raw) {
          setData({ overall_score: 0, frameworks: [], top_gaps: [] });
          return;
        }
        const normalized = {
          overall_score: raw.overallScore ?? raw.overall_score ?? 0,
          frameworks: (raw.frameworks ?? []).map(
            (fw: {
              code: string;
              score?: number;
              controls?: Array<{ status: string; required: boolean }>;
            }) => ({
              code: fw.code,
              score: fw.score ?? 0,
              total_controls: fw.controls?.length ?? 0,
              compliant_controls:
                fw.controls?.filter((c) => c.status === "compliant").length ?? 0,
              non_compliant_controls:
                fw.controls?.filter((c) => c.status === "non_compliant")
                  .length ?? 0,
            }),
          ),
          top_gaps: raw.top_gaps ?? [],
        };
        setData(normalized);
      })
      .catch(() => {
        setData({ overall_score: 0, frameworks: [], top_gaps: [] });
      })
      .finally(() => setLoading(false));
  }, []);

  function downloadReport() {
    const reportData = {
      generated_at: new Date().toISOString(),
      report_type: "compliance_summary",
      data,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus-compliance-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-24 animate-pulse rounded-lg border border-border bg-muted/30" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-lg border border-border bg-muted/30"
            />
          ))}
        </div>
      </div>
    );
  }

  const overallScore = data?.overall_score ?? 0;
  const hasData = overallScore > 0 || (data?.frameworks.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance"
        description="Map your AI asset inventory to the frameworks your auditors care about. Nexus provides evidence — it does not certify compliance."
        secondaryActions={
          <Button variant="outline" size="sm" onClick={downloadReport}>
            <Download className="size-3.5" />
            Download report
          </Button>
        }
      />

      {/* Overall score */}
      <div className="nx-surface flex items-center gap-6 p-6">
        <div className="min-w-[90px] text-center">
          <p
            className={cn(
              "text-5xl font-semibold nx-tabular",
              ScoreColor(overallScore),
            )}
          >
            {overallScore > 0 ? overallScore : "—"}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Overall score
          </p>
        </div>
        <div className="flex-1 border-l border-border pl-6">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {overallScore === 0
              ? "Connect data sources and assess your AI assets to generate a compliance posture score."
              : overallScore >= 80
                ? "Your organization has strong AI governance coverage. Keep monitoring for drift."
                : overallScore >= 50
                  ? "Your compliance posture needs improvement. Review the framework gaps below."
                  : "Significant compliance gaps detected. Immediate attention recommended."}
          </p>
        </div>
      </div>

      {/* Framework cards */}
      {hasData ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {FRAMEWORKS.map((fw) => {
            const fwData = data?.frameworks.find((f) => f.code === fw.code);
            const score = fwData?.score ?? 0;
            return (
              <div
                key={fw.code}
                className="nx-surface space-y-4 p-5 transition-colors hover:border-border-strong"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground">
                    {fw.abbr}
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold tracking-tight">
                      {fw.name}
                    </h3>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {fw.description}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Coverage</span>
                    <span className={cn("font-medium", ScoreColor(score))}>
                      {score > 0 ? `${score}%` : "No data"}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full", ScoreBarColor(score))}
                      style={{ width: score > 0 ? `${score}%` : "100%" }}
                    />
                  </div>
                </div>

                {fwData && fwData.total_controls > 0 && (
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="size-3 text-success" />
                      {fwData.compliant_controls} compliant
                    </span>
                    <span className="flex items-center gap-1">
                      <XCircle className="size-3 text-destructive" />
                      {fwData.non_compliant_controls} gaps
                    </span>
                    <span className="ml-auto nx-tabular">
                      {fwData.total_controls} controls
                    </span>
                  </div>
                )}

                <Link
                  href={`/platform/compliance/${fw.code}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "w-full",
                  )}
                >
                  View details
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="nx-surface">
          <EmptyState
            title="No compliance data yet"
            description="Run your first scan to populate framework mappings and generate an overall coverage score."
            primaryAction={
              <Link
                href="/platform/connectors"
                className={buttonVariants({ size: "sm" })}
              >
                Add connector
              </Link>
            }
          />
        </div>
      )}

      {/* Top gaps */}
      {data && data.top_gaps.length > 0 && (
        <div className="nx-surface">
          <div className="border-b border-border px-5 py-3">
            <h3 className="text-[13px] font-semibold tracking-tight">
              Top compliance gaps
            </h3>
          </div>
          <ul className="divide-y divide-border">
            {data.top_gaps.map((gap, i) => (
              <li
                key={`${gap.framework}-${gap.control_id}-${i}`}
                className="flex items-center gap-3 px-5 py-3"
              >
                <StatusIcon status={gap.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="nx-mono text-[11px] font-semibold text-muted-foreground">
                      {gap.control_id}
                    </span>
                    <span className="text-[13px] font-medium">
                      {gap.control_name}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {gap.framework} · {gap.asset_count} asset
                    {gap.asset_count !== 1 ? "s" : ""} affected
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex h-5 items-center rounded-sm border px-1.5 text-[11px] capitalize",
                    gap.status === "non_compliant"
                      ? "border-destructive/20 bg-destructive/10 text-destructive"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {gap.status.replace("_", " ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* EU AI Act callout */}
      <div className="rounded-lg border border-warning/30 bg-warning/5 p-5">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <h3 className="text-[14px] font-semibold">
              EU AI Act — August 2026 deadline
            </h3>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
              The EU AI Act establishes requirements for documented risk
              management, transparency, and human oversight for high-risk AI
              systems. Enforcement may include fines up to €30M or 6% of global
              annual turnover.
            </p>
            <Link
              href="/platform/compliance/eu_ai_act"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "mt-4",
              )}
            >
              Check EU AI Act readiness
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground/70">
        Nexus provides structured evidence to support your compliance efforts.
        It is not a substitute for a qualified auditor or legal counsel.
      </p>
    </div>
  );
}
