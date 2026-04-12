"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Globe,
  Users,
  Share2,
  Shield,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface Membership {
  joined: boolean;
  tier: string;
  threats_contributed: number;
  joined_at: string | null;
}

interface NetworkStats {
  total_members: number;
  threats_shared: number;
  active_alerts: number;
  avg_response_time: string;
}

interface FeedItem {
  id: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  summary: string;
  source_org: string;
  shared_at: string;
}

interface SharingPreferences {
  share_indicators: boolean;
  share_narratives: boolean;
  anonymous_sharing: boolean;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const severityColor: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive",
  high: "bg-destructive/10 text-destructive",
  medium: "bg-warning/10 text-warning",
  low: "bg-muted text-muted-foreground",
};

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

export function NetworkDashboard() {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [preferences, setPreferences] = useState<SharingPreferences>({
    share_indicators: true,
    share_narratives: false,
    anonymous_sharing: true,
  });
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [membershipRes, statsRes, feedRes] = await Promise.all([
        fetch("/api/network/membership"),
        fetch("/api/network/stats"),
        fetch("/api/network/feed"),
      ]);

      if (membershipRes.ok) {
        const json = await membershipRes.json();
        setMembership(json.data ?? null);
      }

      if (statsRes.ok) {
        const json = await statsRes.json();
        setStats(json.data ?? null);
      }

      if (feedRes.ok) {
        const json = await feedRes.json();
        setFeed(json.data ?? []);
      }
    } catch {
      toast.error("Failed to load network data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function joinNetwork() {
    setJoining(true);
    try {
      const res = await fetch("/api/network/membership", { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        setMembership(json.data ?? { joined: true, tier: "standard", threats_contributed: 0, joined_at: new Date().toISOString() });
        toast.success("Successfully joined the collective defense network");
      } else {
        const json = await res.json();
        toast.error(json.error ?? "Failed to join network");
      }
    } catch {
      toast.error("Failed to join network");
    } finally {
      setJoining(false);
    }
  }

  function togglePreference(key: keyof SharingPreferences) {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
    toast.success("Sharing preference updated");
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-border bg-muted/30"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl border border-border bg-muted/30" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Network stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Members"
          value={stats?.total_members ?? 0}
          icon={Users}
        />
        <StatCard
          label="Threats Shared"
          value={stats?.threats_shared ?? 0}
          icon={Share2}
        />
        <StatCard
          label="Active Alerts"
          value={stats?.active_alerts ?? 0}
          icon={AlertTriangle}
          tone={(stats?.active_alerts ?? 0) > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Avg Response Time"
          value={stats?.avg_response_time ?? "--"}
          icon={Shield}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Membership card */}
        <Card>
          <CardHeader>
            <CardTitle>Membership Status</CardTitle>
            <CardDescription>
              Your organization&apos;s participation in the collective defense
              network.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {membership?.joined ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-success/10">
                    <CheckCircle2 className="size-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Active Member</p>
                    <p className="text-xs text-muted-foreground">
                      Joined{" "}
                      {membership.joined_at
                        ? timeAgo(membership.joined_at)
                        : "recently"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">
                      Contribution Tier
                    </p>
                    <p className="mt-1 text-sm font-semibold capitalize">
                      {membership.tier}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">
                      Threats Contributed
                    </p>
                    <p className="mt-1 text-sm font-semibold nx-tabular">
                      {membership.threats_contributed}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Globe className="size-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium">Not yet a member</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                  Join the collective defense network to share and receive
                  threat intelligence from other organizations.
                </p>
                <Button
                  className="mt-4"
                  size="sm"
                  onClick={joinNetwork}
                  disabled={joining}
                >
                  {joining ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Globe className="size-3.5" />
                  )}
                  Join Network
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Privacy controls */}
        <Card>
          <CardHeader>
            <CardTitle>Privacy Controls</CardTitle>
            <CardDescription>
              Configure what threat data your organization shares with the
              network.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <PrivacyToggle
                label="Share Indicators"
                description="Share IOCs (IPs, domains, hashes) with the network"
                icon={Eye}
                enabled={preferences.share_indicators}
                onToggle={() => togglePreference("share_indicators")}
              />
              <PrivacyToggle
                label="Share Narratives"
                description="Share threat narratives and context details"
                icon={Share2}
                enabled={preferences.share_narratives}
                onToggle={() => togglePreference("share_narratives")}
              />
              <PrivacyToggle
                label="Anonymous Sharing"
                description="Hide your organization identity when sharing"
                icon={EyeOff}
                enabled={preferences.anonymous_sharing}
                onToggle={() => togglePreference("anonymous_sharing")}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Incoming threat feed */}
      <Card>
        <CardHeader>
          <CardTitle>Incoming Threat Feed</CardTitle>
          <CardDescription>
            Real-time threat intelligence shared by network members.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {feed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Shield className="size-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No shared intelligence yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Threat intelligence from network members will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {feed.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/40"
                >
                  <div
                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ${severityColor[item.severity] ?? severityColor.low}`}
                  >
                    <AlertTriangle className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {item.type}
                      </p>
                      <Badge
                        variant={
                          item.severity === "critical" ||
                          item.severity === "high"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {item.severity}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {item.summary}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>From: {item.source_org}</span>
                      <span>&middot;</span>
                      <span>{timeAgo(item.shared_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --------------------------------------------------------------------------
// Privacy toggle subcomponent
// --------------------------------------------------------------------------

function PrivacyToggle({
  label,
  description,
  icon: Icon,
  enabled,
  onToggle,
}: {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Icon className="size-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          enabled ? "bg-primary" : "bg-muted"
        }`}
        aria-label={`${enabled ? "Disable" : "Enable"} ${label}`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
            enabled ? "translate-x-4.5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
