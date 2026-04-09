"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function ScanProgress({ scanId }: { scanId: string }) {
  const [status, setStatus] = useState("pending");
  const [reposScanned, setReposScanned] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/scan/status?id=${scanId}`);
        const data = await res.json();
        if (data.scan) {
          setStatus(data.scan.status);
          setReposScanned(data.scan.repos_scanned);
          if (
            data.scan.status === "completed" ||
            data.scan.status === "complete" ||
            data.scan.status === "failed"
          ) {
            clearInterval(poll);
            router.refresh();
          }
        }
      } catch {
        // Retry on next interval
      }
    }, 3000);

    return () => clearInterval(poll);
  }, [scanId, router]);

  const statusMessages: Record<string, string> = {
    pending: "Preparing scan...",
    scanning: `Scanning repositories (${reposScanned} scanned)...`,
    classifying: "Classifying agents with AI...",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Scan in Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {statusMessages[status] ?? status}
        </p>
        <Progress
          value={
            status === "pending"
              ? 10
              : status === "scanning"
                ? 50
                : status === "classifying"
                  ? 80
                  : 100
          }
        />
      </CardContent>
    </Card>
  );
}
