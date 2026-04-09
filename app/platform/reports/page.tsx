"use client";

import { useState } from "react";
import { FileBarChart, Download, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ReportMeta {
  id: string;
  name: string;
  description: string;
  badge: string;
  icon: string;
}

const REPORTS: ReportMeta[] = [
  {
    id: "executive_summary",
    name: "Executive Summary",
    description: "Board-ready overview of your AI asset posture, risk distribution, and key metrics",
    badge: "PDF + JSON",
    icon: "📊",
  },
  {
    id: "risk_report",
    name: "Risk Assessment Report",
    description: "Detailed breakdown of all AI assets by risk level, with remediation recommendations",
    badge: "PDF",
    icon: "⚠️",
  },
  {
    id: "compliance_report",
    name: "Compliance Report",
    description: "Full compliance posture across all enabled frameworks",
    badge: "PDF",
    icon: "📋",
  },
  {
    id: "orphaned_assets",
    name: "Orphaned Assets Report",
    description: "All AI systems with no active owner, sorted by risk level",
    badge: "CSV + PDF",
    icon: "👻",
  },
  {
    id: "policy_violations",
    name: "Policy Violations Report",
    description: "All open policy violations across your organization",
    badge: "PDF",
    icon: "🚨",
  },
];

function getStoredTimestamp(reportId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`report_generated_${reportId}`);
}

function setStoredTimestamp(reportId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`report_generated_${reportId}`, new Date().toISOString());
}

function formatTimestamp(ts: string | null): string | null {
  if (!ts) return null;
  return new Date(ts).toLocaleString();
}

export default function ReportsPage() {
  const [generating, setGenerating] = useState<string | null>(null);
  const [timestamps, setTimestamps] = useState<Record<string, string | null>>(() => {
    const ts: Record<string, string | null> = {};
    for (const r of REPORTS) {
      ts[r.id] = getStoredTimestamp(r.id);
    }
    return ts;
  });

  async function generateReport(reportId: string) {
    setGenerating(reportId);
    const res = await fetch("/api/analytics");
    const analytics = await res.json();

    const reportData = {
      generated_at: new Date().toISOString(),
      report_type: reportId,
      data: analytics.data,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus-${reportId}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setStoredTimestamp(reportId);
    setTimestamps((prev) => ({ ...prev, [reportId]: new Date().toISOString() }));
    setGenerating(null);
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground mt-1">
          Generate and download compliance and risk reports
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {REPORTS.map((report) => {
          const lastGenerated = formatTimestamp(timestamps[report.id] ?? null);

          return (
            <Card key={report.id}>
              <CardContent className="pt-5">
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-2xl">{report.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{report.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {report.badge}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{report.description}</p>
                    {lastGenerated && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Last generated: {lastGenerated}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => generateReport(report.id)}
                  disabled={generating === report.id}
                >
                  {generating === report.id ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Generate Report
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <FileBarChart className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-semibold">M&A Due Diligence Pack</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Full AI asset inventory for acquisition due diligence. Includes complete
                inventory, risk assessment, ownership chain, compliance status, and executive
                summary. Used by PE firms and corporate development teams.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <Badge>Enterprise Feature</Badge>
                <Button size="sm" variant="outline">
                  Contact Sales
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
