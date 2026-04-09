"use client";

import { ShieldAlert, AlertTriangle, Database, Activity } from "lucide-react";

export function StatsCards({
  totalAgents,
  criticalCount,
  highCount,
  totalScans,
}: {
  totalAgents: number;
  criticalCount: number;
  highCount: number;
  totalScans: number;
}) {
  const stats = [
    {
      title: "AI Assets Found",
      value: totalAgents,
      sub: "Across all scans",
      icon: Database,
      iconColor: "text-muted-foreground",
      valueColor: "",
    },
    {
      title: "Critical Risk",
      value: criticalCount,
      sub: criticalCount > 0 ? "Require immediate attention" : "No critical issues",
      icon: ShieldAlert,
      iconColor: criticalCount > 0 ? "text-red-500" : "text-muted-foreground",
      valueColor: criticalCount > 0 ? "text-red-600" : "",
    },
    {
      title: "High Risk",
      value: highCount,
      sub: highCount > 0 ? "Should be reviewed soon" : "No high-risk issues",
      icon: AlertTriangle,
      iconColor: highCount > 0 ? "text-orange-500" : "text-muted-foreground",
      valueColor: highCount > 0 ? "text-orange-600" : "",
    },
    {
      title: "Scans Run",
      value: totalScans,
      sub: "Organization scans",
      icon: Activity,
      iconColor: "text-muted-foreground",
      valueColor: "",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.title} className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">{stat.title}</span>
              <Icon className={`h-4 w-4 ${stat.iconColor}`} />
            </div>
            <div className={`text-3xl font-bold ${stat.valueColor}`}>{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
          </div>
        );
      })}
    </div>
  );
}
