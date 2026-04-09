"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

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
  const org = searchParams.get("org") || "your organization";

  const [scan, setScan] = useState<ScanStatus>({ status: "pending", repos_scanned: 0, agents_found: 0 });
  const [elapsed, setElapsed] = useState(0);

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Poll
  useEffect(() => {
    if (!scanId) return;
    let attempts = 0;
    const MAX_ATTEMPTS = 100;

    const poll = async () => {
      try {
        const res = await fetch(`/api/scan/status?id=${scanId}`);
        if (!res.ok) return;
        const data = await res.json();
        const scanData: ScanStatus = data.scan ?? data; // API returns { scan: {...} } shape
        setScan(scanData);
        attempts++;
        if (scanData.status === "complete" || scanData.status === "completed") {
          clearInterval(interval);
          router.push(`/dashboard/scan/${scanId}`);
        } else if (scanData.status === "failed") {
          clearInterval(interval);
        } else if (attempts >= MAX_ATTEMPTS) {
          clearInterval(interval);
          setScan((prev) => ({ ...prev, status: "failed", error_message: "Scan timed out. Please try again." }));
        }
      } catch { /* keep polling */ }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [scanId, router]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const isFailed = scan.status === "failed";
  const isComplete = scan.status === "complete" || scan.status === "completed";

  const steps = [
    { label: "Authenticating with GitHub",       done: scan.status !== "pending" },
    { label: "Fetching repository list",          done: scan.repos_scanned > 0 },
    { label: "Scanning repositories",             done: scan.agents_found > 0 },
    { label: "Classifying AI assets",             done: isComplete },
    { label: "Generating report",                 done: isComplete },
  ];

  const currentStep = steps.findIndex((s) => !s.done);
  const progressPct = isComplete ? 100 : Math.min(
    currentStep === -1 ? 95 : (currentStep / steps.length) * 100 + 5,
    95
  );

  return (
    <div className="min-h-screen bg-[#07070c] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-violet-600">
              <span className="text-sm font-bold text-white">N</span>
            </div>
            <span className="font-semibold text-white">Nexus</span>
          </div>
          {isFailed ? (
            <>
              <h1 className="text-xl font-semibold text-white">Scan could not complete</h1>
              <p className="text-sm text-white/40">
                {scan.error_message === "GitHub not configured"
                  ? "No GitHub organization is configured. Check your settings and try again."
                  : scan.error_message ?? "An error occurred during the scan."}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-white">Scanning {org}</h1>
              <p className="text-sm text-white/40">This usually takes 1–3 minutes depending on repository count.</p>
            </>
          )}
        </div>

        {/* Main card */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 space-y-5">

          {!isFailed && (
            <>
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-white/30">
                  <span>{isComplete ? "Complete" : "In progress"}</span>
                  <span>{formatTime(elapsed)}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-all duration-700"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-2.5">
                {steps.map((step, i) => {
                  const isActive = i === currentStep;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold transition-colors ${
                        step.done
                          ? "bg-emerald-500/20 text-emerald-400"
                          : isActive
                          ? "bg-violet-500/20 text-violet-400"
                          : "bg-white/[0.04] text-white/20"
                      }`}>
                        {step.done ? (
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : isActive ? (
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                        ) : (
                          <span className="text-[9px]">{i + 1}</span>
                        )}
                      </div>
                      <span className={`text-sm transition-colors ${
                        step.done ? "text-white/60" : isActive ? "text-white" : "text-white/25"
                      }`}>
                        {step.label}
                      </span>
                      {isActive && (
                        <span className="ml-auto text-xs text-violet-400/60 animate-pulse">Running</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Live stats */}
              {(scan.repos_scanned > 0 || scan.agents_found > 0) && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                    <div className="text-2xl font-bold text-white">{scan.repos_scanned}</div>
                    <div className="text-xs text-white/30 mt-0.5">Repos scanned</div>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                    <div className={`text-2xl font-bold ${scan.agents_found > 0 ? "text-violet-300" : "text-white"}`}>
                      {scan.agents_found}
                    </div>
                    <div className="text-xs text-white/30 mt-0.5">Assets found</div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Error state */}
          {isFailed && (
            <div className="space-y-4">
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                <p className="text-sm text-red-300">
                  {scan.error_message ?? "The scan failed unexpectedly. Please try again."}
                </p>
              </div>
              <div className="flex gap-3">
                <Link
                  href="/dashboard"
                  className="flex-1 text-center text-sm font-medium text-white/50 hover:text-white border border-white/10 hover:border-white/20 rounded-lg px-4 py-2.5 transition-all"
                >
                  Back to dashboard
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="flex-1 text-center text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-4 py-2.5 transition-colors"
                >
                  Check settings
                </Link>
              </div>
            </div>
          )}
        </div>

        {!isFailed && (
          <p className="text-center text-xs text-white/20">
            You can close this tab. Results will be saved to your dashboard.
          </p>
        )}
      </div>
    </div>
  );
}

export default function ScanRunningPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#07070c] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-violet-600">
            <span className="text-sm font-bold text-white">N</span>
          </div>
          <span className="text-white/50 text-sm">Loading…</span>
        </div>
      </div>
    }>
      <ScanRunningInner />
    </Suspense>
  );
}
