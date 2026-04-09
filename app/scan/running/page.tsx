"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ScanStatus {
  status: string;
  repos_scanned: number;
  agents_found: number;
  error_message?: string;
}

function ScanRunningInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scanId = searchParams.get("scanId");
  const org = searchParams.get("org") || "your org";

  const [scan, setScan] = useState<ScanStatus>({ status: "pending", repos_scanned: 0, agents_found: 0 });
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 500);
    return () => clearInterval(dotsInterval);
  }, []);

  useEffect(() => {
    if (!scanId) return;

    let attempts = 0;
    const MAX_ATTEMPTS = 100; // 5 minutes at 3s intervals

    const poll = async () => {
      try {
        const res = await fetch(`/api/scan/status?id=${scanId}`);
        if (!res.ok) return;
        const data = await res.json();
        setScan(data);
        attempts++;

        if (data.status === "complete" || data.status === "completed") {
          clearInterval(interval);
          router.push(`/dashboard/scan/${scanId}`);
        } else if (data.status === "failed") {
          clearInterval(interval);
        } else if (attempts >= MAX_ATTEMPTS) {
          clearInterval(interval);
          setScan((prev) => ({ ...prev, status: "failed", error_message: "Scan timed out after 5 minutes." }));
        }
      } catch {
        // Network error — keep polling
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [scanId, router]);

  const progressValue = Math.min(
    scan.repos_scanned > 0 ? (scan.repos_scanned / Math.max(scan.repos_scanned + 5, 20)) * 100 : 10,
    95
  );

  const steps = [
    { label: "Connecting to GitHub", done: scan.status !== "pending" },
    { label: "Discovering repositories", done: scan.repos_scanned > 0 },
    { label: "Scanning for AI agents", done: scan.agents_found > 0 },
    { label: "Classifying agents with AI", done: scan.status === "complete" },
    { label: "Building your report", done: scan.status === "complete" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-gray-900 border-gray-800">
        <CardHeader className="text-center">
          <div className="text-4xl mb-4">👻</div>
          <CardTitle className="text-white text-2xl">
            Scanning {org}{dots}
          </CardTitle>
          {scan.status === "failed" && (
            <p className="text-red-400 text-sm mt-2">
              {scan.error_message || "Scan failed. Please check your token and try again."}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <Progress value={scan.status === "complete" ? 100 : progressValue} className="h-2" />

          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  step.done ? "bg-green-500 text-white" : "bg-gray-700 text-gray-400"
                }`}>
                  {step.done ? "✓" : i + 1}
                </div>
                <span className={step.done ? "text-gray-200" : "text-gray-500"}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          <div className="bg-gray-800 rounded-lg p-4 text-center space-y-1">
            <div className="text-2xl font-bold text-white">{scan.agents_found}</div>
            <div className="text-gray-400 text-sm">AI agents found so far</div>
            {scan.repos_scanned > 0 && (
              <div className="text-gray-500 text-xs">{scan.repos_scanned} repos scanned</div>
            )}
          </div>

          <p className="text-gray-500 text-xs text-center">
            Usually takes 60–120 seconds depending on repo count.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ScanRunningPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-xl">👻 Loading...</div>
      </div>
    }>
      <ScanRunningInner />
    </Suspense>
  );
}
