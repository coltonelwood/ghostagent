"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Scan } from "@/lib/types";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  scanning: "bg-blue-100 text-blue-800",
  classifying: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

export function ScansList({ scans }: { scans: Scan[] }) {
  if (scans.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            No scans yet. Run your first scan to find ghost agents.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Scans</CardTitle>
        <CardDescription>History of your organization scans</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {scans.map((scan) => (
            <Link
              key={scan.id}
              href={`/dashboard/scan/${scan.id}`}
              className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    Scan {scan.id.slice(0, 8)}
                  </span>
                  <Badge
                    variant="secondary"
                    className={statusColors[scan.status] ?? ""}
                  >
                    {scan.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {scan.repos_scanned} repos scanned &middot;{" "}
                  {scan.agents_found} agents found
                </p>
              </div>
              <span className="text-sm text-muted-foreground">
                {new Date(scan.started_at).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
