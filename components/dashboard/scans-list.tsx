"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, Clock, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import type { Scan } from "@/lib/types";

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  pending:     { label: "Queued",      icon: <Clock className="h-3.5 w-3.5" />,    className: "text-muted-foreground border-border" },
  scanning:    { label: "Scanning",    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, className: "text-blue-700 bg-blue-50 border-blue-200" },
  classifying: { label: "Classifying", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, className: "text-violet-700 bg-violet-50 border-violet-200" },
  completed:   { label: "Completed",   icon: <CheckCircle2 className="h-3.5 w-3.5" />, className: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  failed:      { label: "Failed",      icon: <XCircle className="h-3.5 w-3.5" />,  className: "text-red-700 bg-red-50 border-red-200" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ScansList({ scans }: { scans: Scan[] }) {
  if (scans.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="font-medium text-sm">No scans yet</p>
          <p className="text-sm text-muted-foreground">
            Run your first scan above to discover AI assets in your organization.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent Scans</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {scans.map((scan) => {
            const config = STATUS_CONFIG[scan.status] ?? STATUS_CONFIG.pending;
            const isRunning = ["pending", "scanning", "classifying"].includes(scan.status);
            return (
              <Link
                key={scan.id}
                href={`/dashboard/scan/${scan.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {isRunning ? "Scan in progress" : `Scan — ${formatDate(scan.started_at)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      {scan.repos_scanned != null && (
                        <span>{scan.repos_scanned} repos scanned</span>
                      )}
                      {scan.agents_found != null && scan.agents_found > 0 && (
                        <span className="text-foreground font-medium">{scan.agents_found} AI assets found</span>
                      )}
                      {scan.agents_found === 0 && scan.status === "completed" && (
                        <span>No AI assets detected</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="outline" className={`flex items-center gap-1.5 text-xs ${config.className}`}>
                    {config.icon}
                    {config.label}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
