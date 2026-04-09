"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      title: "Ghost Agents Found",
      value: totalAgents,
      description: "Across all scans",
    },
    {
      title: "Critical Risk",
      value: criticalCount,
      description: "Require immediate action",
      className: criticalCount > 0 ? "text-red-600" : "",
    },
    {
      title: "High Risk",
      value: highCount,
      description: "Should be reviewed",
      className: highCount > 0 ? "text-orange-500" : "",
    },
    {
      title: "Total Scans",
      value: totalScans,
      description: "Organization scans run",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${stat.className ?? ""}`}>
              {stat.value}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
