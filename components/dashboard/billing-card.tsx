"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ArrowRight } from "lucide-react";
import type { Workspace } from "@/lib/types";

const PRO_FEATURES = [
  "Unlimited scans",
  "Up to 1,000 AI assets tracked",
  "Risk scoring + ownership engine",
  "Full scan history",
  "Priority support",
];

export function BillingCard({ workspace }: { workspace: Workspace }) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspace.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to start checkout. Please try again.");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleManage = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspace.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to open billing portal. Please try again.");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isPro = workspace.plan !== "trial";

  return (
    <div className="rounded-xl border bg-card p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold">Billing</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isPro ? "Manage your subscription and invoices." : "Upgrade to unlock unlimited scans."}
        </p>
      </div>

      {isPro ? (
        /* Active subscription */
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium capitalize">{workspace.plan} plan — active</span>
          </div>
          <button
            onClick={handleManage}
            disabled={loading}
            className="text-sm font-medium text-muted-foreground hover:text-foreground border rounded-lg px-4 py-2 transition-all disabled:opacity-50"
          >
            {loading ? "Opening…" : "Manage subscription →"}
          </button>
        </div>
      ) : (
        /* Trial / upgrade */
        <div className="space-y-4">
          <div className="rounded-xl border-2 border-violet-200/60 bg-violet-50/30 p-5">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <h3 className="font-semibold text-base">Pro Plan</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Everything you need to run production AI governance</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold">$399</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
            </div>
            <ul className="space-y-2 mb-5">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
            >
              {loading ? "Redirecting…" : <>Upgrade to Pro <ArrowRight className="h-4 w-4" /></>}
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            You&apos;ve used {workspace.scan_count} of 1 free scan.
            {" "}Cancel anytime. No long-term commitment.
          </p>
        </div>
      )}
    </div>
  );
}
