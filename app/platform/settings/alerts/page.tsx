"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EVENT_KINDS = [
  { key: "asset_discovered", label: "Asset Discovered" },
  { key: "asset_changed", label: "Asset Changed" },
  { key: "asset_quarantined", label: "Asset Quarantined" },
  { key: "owner_departed", label: "Owner Departed" },
  { key: "owner_orphaned", label: "Asset Orphaned" },
  { key: "risk_increased", label: "Risk Increased" },
  { key: "policy_violated", label: "Policy Violated" },
  { key: "connector_sync_failed", label: "Sync Failed" },
];

const CHANNELS = ["slack", "email", "webhook"] as const;

const DIGEST_SCHEDULES = [
  { value: "daily_9am", label: "Daily at 9:00 AM" },
  { value: "daily_5pm", label: "Daily at 5:00 PM" },
  { value: "weekly_monday", label: "Weekly on Monday" },
  { value: "weekly_friday", label: "Weekly on Friday" },
];

interface AlertPrefs {
  slack_webhook_url: string | null;
  slack_channel: string | null;
  email_recipients: string[];
  webhook_urls: string[];
  digest_mode: boolean;
  digest_schedule: string;
  event_filter_matrix: Record<string, Record<string, boolean>>;
}

export default function AlertsPage() {
  const [prefs, setPrefs] = useState<AlertPrefs>({
    slack_webhook_url: null,
    slack_channel: null,
    email_recipients: [],
    webhook_urls: [],
    digest_mode: false,
    digest_schedule: "weekly_monday",
    event_filter_matrix: {},
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newWebhook, setNewWebhook] = useState("");
  const [testing, setTesting] = useState<string | null>(null);

  async function sendTest(channel: "slack" | "email" | "webhook") {
    setTesting(channel);
    try {
      const res = await fetch("/api/org/alerts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? "Test failed");
      } else {
        toast.success(d.message ?? "Test sent successfully");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setTesting(null);
    }
  }

  useEffect(() => {
    fetch("/api/org/alerts")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) {
          setPrefs({
            ...prefs,
            ...d.data,
            event_filter_matrix: d.data.event_filter_matrix ?? {},
          });
        }
      });
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/org/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "Failed to save alert preferences");
      } else {
        toast.success("Alert preferences saved");
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function addEmail() {
    if (!newEmail || prefs.email_recipients.includes(newEmail)) return;
    setPrefs({ ...prefs, email_recipients: [...prefs.email_recipients, newEmail] });
    setNewEmail("");
  }

  function removeEmail(email: string) {
    setPrefs({
      ...prefs,
      email_recipients: prefs.email_recipients.filter((e) => e !== email),
    });
  }

  function addWebhook() {
    if (!newWebhook || prefs.webhook_urls.includes(newWebhook)) return;
    setPrefs({ ...prefs, webhook_urls: [...prefs.webhook_urls, newWebhook] });
    setNewWebhook("");
  }

  function toggleEventChannel(eventKind: string, channel: string) {
    setPrefs((prev) => {
      const matrix = { ...prev.event_filter_matrix };
      if (!matrix[eventKind]) matrix[eventKind] = {};
      matrix[eventKind] = {
        ...matrix[eventKind],
        [channel]: !matrix[eventKind][channel],
      };
      return { ...prev, event_filter_matrix: matrix };
    });
  }

  function isEventChannelEnabled(eventKind: string, channel: string): boolean {
    return prefs.event_filter_matrix[eventKind]?.[channel] ?? false;
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Alert Preferences</h1>
        <p className="text-muted-foreground mt-1">
          Configure how and where Spekris sends alerts
        </p>
      </div>

      {/* Slack */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Slack</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                type="url"
                value={prefs.slack_webhook_url ?? ""}
                onChange={(e) =>
                  setPrefs({ ...prefs, slack_webhook_url: e.target.value || null })
                }
                placeholder="https://hooks.slack.com/services/..."
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => sendTest("slack")}
                disabled={!prefs.slack_webhook_url || testing === "slack"}
                title="Send a test message to Slack"
              >
                {testing === "slack" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="ml-1.5">Send test</span>
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Default Channel (optional)</Label>
            <Input
              value={prefs.slack_channel ?? ""}
              onChange={(e) =>
                setPrefs({ ...prefs, slack_channel: e.target.value || null })
              }
              placeholder="#spekris-alerts"
            />
          </div>
        </CardContent>
      </Card>

      {/* Email */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Email Recipients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {prefs.email_recipients.map((email) => (
            <div key={email} className="flex items-center gap-2">
              <span className="flex-1 text-sm">{email}</span>
              <button
                onClick={() => removeEmail(email)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="alerts@company.com"
              onKeyDown={(e) => e.key === "Enter" && addEmail()}
            />
            <Button variant="outline" size="sm" onClick={addEmail}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Outbound Webhooks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Spekris will POST a signed JSON payload to these URLs for each event.
          </p>
          {prefs.webhook_urls.map((url) => (
            <div key={url} className="flex items-center gap-2">
              <span className="flex-1 text-sm font-mono truncate">{url}</span>
              <button
                onClick={() =>
                  setPrefs({
                    ...prefs,
                    webhook_urls: prefs.webhook_urls.filter((u) => u !== url),
                  })
                }
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              type="url"
              value={newWebhook}
              onChange={(e) => setNewWebhook(e.target.value)}
              placeholder="https://your-system.com/hooks/spekris"
              onKeyDown={(e) => e.key === "Enter" && addWebhook()}
            />
            <Button variant="outline" size="sm" onClick={addWebhook}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Event filter matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Event Routing</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Choose which events are sent to which channels.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-xs text-muted-foreground">
                    Event
                  </th>
                  {CHANNELS.map((ch) => (
                    <th
                      key={ch}
                      className="text-center py-2 px-3 font-medium text-xs text-muted-foreground capitalize"
                    >
                      {ch}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EVENT_KINDS.map((event) => (
                  <tr key={event.key} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-sm">{event.label}</td>
                    {CHANNELS.map((ch) => (
                      <td key={ch} className="text-center py-2 px-3">
                        <input
                          type="checkbox"
                          checked={isEventChannelEnabled(event.key, ch)}
                          onChange={() => toggleEventChannel(event.key, ch)}
                          className="rounded"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Digest mode */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.digest_mode}
              onChange={(e) => setPrefs({ ...prefs, digest_mode: e.target.checked })}
              className="rounded"
            />
            <div>
              <p className="text-sm font-medium">Digest Mode</p>
              <p className="text-xs text-muted-foreground">
                Batch all alerts into a single digest instead of real-time notifications
              </p>
            </div>
          </label>

          {prefs.digest_mode && (
            <div className="ml-7 space-y-1.5">
              <Label>Digest Schedule</Label>
              <select
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                value={prefs.digest_schedule}
                onChange={(e) => setPrefs({ ...prefs, digest_schedule: e.target.value })}
              >
                {DIGEST_SCHEDULES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : saved ? (
          "Saved!"
        ) : (
          "Save Alert Preferences"
        )}
      </Button>
    </div>
  );
}
