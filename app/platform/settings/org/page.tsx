"use client";

import { useEffect, useState } from "react";
import { Copy, CheckCheck, Loader2, Eye, EyeOff, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { Organization } from "@/lib/types/platform";

export default function OrgSettingsPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    fetch("/api/org")
      .then((r) => r.json())
      .then((d) => {
        setOrg(d.data);
        setName(d.data?.name ?? "");
      });
  }, []);

  async function save() {
    setSaving(true);
    await fetch("/api/org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function copySDKKey() {
    if (org?.sdk_api_key) {
      navigator.clipboard.writeText(org.sdk_api_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function regenerateKey() {
    if (!confirm("Regenerate your SDK API key? The old key will stop working immediately."))
      return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/org/regenerate-key", { method: "POST" });
      const data = await res.json();
      if (data.data?.sdk_api_key && org) {
        setOrg({ ...org, sdk_api_key: data.data.sdk_api_key });
        setKeyRevealed(true);
      }
    } finally {
      setRegenerating(false);
    }
  }

  if (!org) {
    return (
      <div className="p-8">
        <div className="h-96 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Organization Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your organization details</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Organization Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Organization Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Slug</Label>
            <Input value={org.slug} disabled className="text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <div className="flex items-center gap-2">
              <Badge className="capitalize">{org.plan}</Badge>
              {org.plan !== "enterprise" && (
                <LinkButton href="/platform/settings/billing" size="sm" variant="outline">
                  Upgrade Plan
                </LinkButton>
              )}
            </div>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : saved ? (
              "Saved!"
            ) : (
              "Save Changes"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* SDK API Key */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">SDK API Key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Use this key to report AI assets from your internal systems using the Nexus SDK.
          </p>
          <div className="flex gap-2">
            <Input
              value={keyRevealed ? org.sdk_api_key : "••••••••••••••••••••••••••••••••"}
              readOnly
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setKeyRevealed(!keyRevealed)}
              title={keyRevealed ? "Hide key" : "Reveal key"}
            >
              {keyRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={copySDKKey} title="Copy key">
              {copied ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={regenerateKey}
            disabled={regenerating}
            className="text-destructive hover:text-destructive"
          >
            {regenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Regenerate Key
              </>
            )}
          </Button>
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs font-semibold mb-2">SDK Usage (npm)</p>
            <pre className="text-xs overflow-x-auto">{`curl -X POST ${typeof window !== "undefined" ? window.location.origin : ""}/api/sdk/report \\
  -H "Authorization: Bearer ${keyRevealed ? org.sdk_api_key : org.sdk_api_key.slice(0, 8) + "..."}..." \\
  -H "Content-Type: application/json" \\
  -d '{"name":"my-ai-agent","owner":"eng@company.com","services":["openai"]}'`}</pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
