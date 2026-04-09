"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, AlertCircle, HelpCircle, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";

const FRAMEWORKS = [
  {
    code: "eu_ai_act",
    name: "EU AI Act",
    description: "European Union AI regulation effective August 2026",
    icon: "🇪🇺",
  },
  {
    code: "soc2_ai",
    name: "SOC 2 AI Controls",
    description: "SOC 2 controls relevant to AI systems",
    icon: "🛡️",
  },
  {
    code: "iso42001",
    name: "ISO/IEC 42001",
    description: "International AI management system standard",
    icon: "📋",
  },
  {
    code: "nist_ai_rmf",
    name: "NIST AI RMF",
    description: "NIST AI Risk Management Framework",
    icon: "🏛️",
  },
];

function ComplianceGauge({ score, label }: { score: number; label: string }) {
  const color =
    score >= 80
      ? "text-emerald-500"
      : score >= 50
        ? "text-yellow-500"
        : score > 0
          ? "text-destructive"
          : "text-muted-foreground";
  const bgColor =
    score >= 80
      ? "bg-emerald-500"
      : score >= 50
        ? "bg-yellow-500"
        : score > 0
          ? "bg-destructive"
          : "bg-muted-foreground/20";

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className={color}>{score > 0 ? `${score}%` : "No data"}</span>
      </div>
      <div className="h-2 bg-muted rounded-full">
        <div
          className={`h-2 rounded-full transition-all ${bgColor}`}
          style={{ width: score > 0 ? `${score}%` : "100%" }}
        />
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "compliant":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "non_compliant":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "needs_review":
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    default:
      return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

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

export default function CompliancePage() {
  const [data, setData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/compliance")
      .then((r) => r.json())
      .then((d) => {
        setData(
          d.data ?? {
            overall_score: 0,
            frameworks: [],
            top_gaps: [],
          }
        );
      })
      .catch(() => {
        setData({ overall_score: 0, frameworks: [], top_gaps: [] });
      })
      .finally(() => setLoading(false));
  }, []);

  function downloadReport() {
    const reportData = {
      generated_at: new Date().toISOString(),
      report_type: "compliance_posture",
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
      <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded-xl" />
        <div className="grid sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const overallScore = data?.overall_score ?? 0;
  const overallColor =
    overallScore >= 80
      ? "text-emerald-500"
      : overallScore >= 50
        ? "text-yellow-500"
        : overallScore > 0
          ? "text-destructive"
          : "text-muted-foreground";

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compliance</h1>
          <p className="text-muted-foreground mt-1">
            Track your AI governance against industry frameworks
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadReport}>
            <Download className="h-4 w-4 mr-1.5" />
            Download Report
          </Button>
        </div>
      </div>

      {/* Overall posture score */}
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center gap-6">
            <div className="text-center min-w-[80px]">
              <p className={`text-5xl font-bold ${overallColor}`}>
                {overallScore > 0 ? overallScore : "--"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Overall Score</p>
            </div>
            <div className="flex-1 border-l pl-6">
              <p className="text-sm text-muted-foreground">
                {overallScore === 0
                  ? "Connect data sources and assess your AI assets to generate a compliance posture score."
                  : overallScore >= 80
                    ? "Your organization has strong AI governance compliance. Keep monitoring for changes."
                    : overallScore >= 50
                      ? "Your compliance posture needs improvement. Review the gaps below."
                      : "Significant compliance gaps detected. Immediate attention required."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Framework cards with ComplianceGauge */}
      <div className="grid sm:grid-cols-2 gap-4">
        {FRAMEWORKS.map((fw) => {
          const fwData = data?.frameworks.find((f) => f.code === fw.code);
          const score = fwData?.score ?? 0;

          return (
            <Card key={fw.code} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{fw.icon}</span>
                  <div>
                    <CardTitle className="text-base">{fw.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">{fw.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ComplianceGauge score={score} label="Coverage" />

                {fwData && fwData.total_controls > 0 && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      {fwData.compliant_controls} compliant
                    </span>
                    <span className="flex items-center gap-1">
                      <XCircle className="h-3 w-3 text-destructive" />
                      {fwData.non_compliant_controls} gaps
                    </span>
                    <span>{fwData.total_controls} total</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <LinkButton
                    href={`/platform/compliance/${fw.code}`}
                    size="sm"
                    className="flex-1"
                  >
                    View Details
                  </LinkButton>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Top gaps table */}
      {data && data.top_gaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top Compliance Gaps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {data.top_gaps.map((gap, i) => (
                <div
                  key={`${gap.framework}-${gap.control_id}-${i}`}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <StatusIcon status={gap.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-muted-foreground">
                        {gap.control_id}
                      </span>
                      <span className="text-sm font-medium">{gap.control_name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {gap.framework} - {gap.asset_count} asset
                      {gap.asset_count !== 1 ? "s" : ""} affected
                    </p>
                  </div>
                  <Badge
                    variant={gap.status === "non_compliant" ? "destructive" : "outline"}
                    className="capitalize text-xs"
                  >
                    {gap.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* EU AI Act urgency callout */}
      <Card className="border-orange-500/30 bg-orange-500/5">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⏰</span>
            <div>
              <h3 className="font-semibold">EU AI Act — August 2026 Deadline</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                The EU AI Act requires documented risk management, transparency, and human
                oversight for high-risk AI systems. Non-compliance can result in fines up to
                30M EUR or 6% of global annual turnover.
              </p>
              <LinkButton href="/platform/compliance/eu_ai_act" size="sm" className="mt-3">
                Check EU AI Act Readiness
              </LinkButton>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
