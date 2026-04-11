"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Organization } from "@/lib/types/platform";
import { PLAN_LIMITS } from "@/lib/entitlements";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "$499/month",
    description: "For teams getting started with AI governance",
    features: [
      "50 AI assets",
      "3 connectors",
      "EU AI Act framework",
      "Email + Slack alerts",
      "1 compliance framework",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    price: "$2,500/month",
    description: "For organizations deploying AI at scale",
    features: [
      "500 AI assets",
      "Unlimited connectors",
      "All compliance frameworks",
      "HR integration",
      "API access",
      "Policy automation",
    ],
    featured: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    description: "For large organizations with enterprise requirements",
    features: [
      "Unlimited assets",
      "Multi-org management",
      "SSO / SCIM",
      "Custom frameworks",
      "SLA + dedicated CSM",
      "On-prem option",
    ],
  },
];

export default function BillingPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [assetCount, setAssetCount] = useState(0);
  const [connectorCount, setConnectorCount] = useState(0);
  const [managing, setManaging] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponMessage, setCouponMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/org").then((r) => r.json()),
      fetch("/api/analytics").then((r) => r.json()),
    ]).then(([orgData, analyticsData]) => {
      setOrg(orgData.data);
      setAssetCount(analyticsData.data?.totalAssets ?? 0);
      setConnectorCount(analyticsData.data?.connectorCount ?? 0);
    });
  }, []);

  async function manageBilling() {
    setManaging(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setUpgradeError(data.error ?? "Could not open billing portal.");
    } catch {
      setUpgradeError("Network error. Please try again.");
    }
    setManaging(false);
  }

  async function upgradePlan() {
    setUpgrading(true);
    setUpgradeError("");
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setUpgradeError(data.error ?? "Could not start checkout.");
    } catch {
      setUpgradeError("Network error. Please try again.");
    }
    setUpgrading(false);
  }

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setApplyingCoupon(true);
    setCouponMessage(null);
    try {
      const res = await fetch("/api/billing/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setCouponMessage({ type: "success", text: data.message ?? "Coupon applied successfully!" });
        setCouponCode("");
      } else {
        setCouponMessage({ type: "error", text: data.error ?? "Invalid coupon code" });
      }
    } catch {
      setCouponMessage({ type: "error", text: "Failed to apply coupon. Please try again." });
    } finally {
      setApplyingCoupon(false);
    }
  }

  if (!org) {
    return (
      <div className="p-8">
        <div className="h-96 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  const limits = PLAN_LIMITS[org.plan] ?? PLAN_LIMITS.starter;

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground mt-1">Manage your plan and usage</p>
      </div>

      {/* Current plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Current Plan</CardTitle>
            <Badge className="capitalize">{org.plan}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Assets</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-1.5">
                  <div
                    className="h-1.5 bg-primary rounded-full"
                    style={{
                      width:
                        limits.maxAssets === -1
                          ? "20%"
                          : `${Math.min(100, (assetCount / limits.maxAssets) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {assetCount} / {limits.maxAssets === -1 ? "∞" : limits.maxAssets}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Connectors</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-1.5">
                  <div
                    className="h-1.5 bg-primary rounded-full"
                    style={{
                      width:
                        limits.maxConnectors === -1
                          ? "20%"
                          : `${Math.min(100, (connectorCount / limits.maxConnectors) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {connectorCount} / {limits.maxConnectors === -1 ? "∞" : limits.maxConnectors}
                </span>
              </div>
            </div>
          </div>

          {org.stripe_subscription_id && (
            <Button variant="outline" onClick={manageBilling} disabled={managing}>
              {managing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                "Manage Subscription"
              )}
            </Button>
          )}
          {upgradeError && (
            <p className="text-sm text-destructive">{upgradeError}</p>
          )}
        </CardContent>
      </Card>

      {/* Coupon code */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Coupon Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Have a founding member or promotional code? Enter it here.
          </p>
          <div className="flex gap-2">
            <Input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="Enter coupon code"
              onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
            />
            <Button
              variant="outline"
              onClick={applyCoupon}
              disabled={applyingCoupon || !couponCode.trim()}
            >
              {applyingCoupon ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Apply"
              )}
            </Button>
          </div>
          {couponMessage && (
            <p
              className={`text-sm ${
                couponMessage.type === "success" ? "text-emerald-600" : "text-destructive"
              }`}
            >
              {couponMessage.text}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Plans */}
      {org.plan !== "enterprise" && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Plans
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {PLANS.map((plan) => (
              <Card
                key={plan.id}
                className={plan.featured ? "border-primary shadow-md" : ""}
              >
                {plan.featured && (
                  <div className="bg-primary text-primary-foreground text-xs font-semibold text-center py-1 rounded-t-xl">
                    Most Popular
                  </div>
                )}
                <CardContent className="pt-5">
                  <h3 className="font-bold text-lg">{plan.name}</h3>
                  <p className="text-2xl font-bold mt-1">{plan.price}</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    {plan.description}
                  </p>
                  <ul className="space-y-1.5 mb-4">
                    {plan.features.map((f) => (
                      <li key={f} className="text-xs flex items-center gap-1.5">
                        <span className="text-emerald-500">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  {plan.id === org.plan ? (
                    <Button variant="outline" size="sm" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : plan.id === "enterprise" ? (
                    <Button size="sm" className="w-full" variant="outline">
                      Contact Sales <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={upgradePlan}
                      disabled={upgrading}
                    >
                      {upgrading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>Upgrade <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
