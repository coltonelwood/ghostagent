"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Workspace } from "@/lib/types";

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
        toast.error(data.error ?? "Failed to start checkout");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error("Network error — please try again");
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
        toast.error(data.error ?? "Failed to open billing portal");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
        <CardDescription>Manage your subscription</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Current Plan:</span>
          <Badge variant={workspace.plan === "trial" ? "secondary" : "default"}>
            {workspace.plan === "trial"
              ? "Free Trial"
              : workspace.plan.toUpperCase()}
          </Badge>
        </div>

        {workspace.plan === "trial" ? (
          <div className="space-y-3">
            <div className="rounded-lg border p-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <h3 className="font-semibold">Pro Plan</h3>
                  <p className="text-sm text-muted-foreground">
                    Unlimited scans, unlimited agents, priority support
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold">$399</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
              </div>
            </div>
            <Button onClick={handleUpgrade} disabled={loading}>
              {loading ? "Loading..." : "Upgrade to Pro"}
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={handleManage} disabled={loading}>
            {loading ? "Loading..." : "Manage Subscription"}
          </Button>
        )}

        <div className="text-sm text-muted-foreground">
          Scans used: {workspace.scan_count}
          {workspace.plan === "trial" && " / 1"}
        </div>
      </CardContent>
    </Card>
  );
}
