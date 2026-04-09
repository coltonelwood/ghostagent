"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plug, Users, ArrowRight, ArrowLeft, Loader2, SkipForward } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Organization", icon: Building2 },
  { label: "Connect Source", icon: Plug },
  { label: "Invite Team", icon: Users },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [orgCreated, setOrgCreated] = useState(false);
  const [orgError, setOrgError] = useState("");

  // Step 2 state
  const [connectorKind, setConnectorKind] = useState<"github" | "zapier" | null>(null);
  const [connectorToken, setConnectorToken] = useState("");
  const [connectingSource, setConnectingSource] = useState(false);
  const [sourceConnected, setSourceConnected] = useState(false);
  const [sourceError, setSourceError] = useState("");

  // Step 3 state
  const [inviteEmails, setInviteEmails] = useState<string[]>([""]);
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviting, setInviting] = useState(false);
  const [invitesSent, setInvitesSent] = useState(false);
  const [inviteError, setInviteError] = useState("");

  async function createOrg() {
    if (!orgName.trim()) {
      setOrgError("Organization name is required");
      return;
    }
    setCreatingOrg(true);
    setOrgError("");
    try {
      const res = await fetch("/api/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOrgError(data.error ?? "Failed to create organization");
        setCreatingOrg(false);
        return;
      }
      setOrgCreated(true);
      setCreatingOrg(false);
      setStep(1);
    } catch {
      setOrgError("Network error. Please try again.");
      setCreatingOrg(false);
    }
  }

  async function connectSource() {
    if (!connectorKind) return;
    setConnectingSource(true);
    setSourceError("");
    try {
      const res = await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: connectorKind,
          name: connectorKind === "github" ? "GitHub" : "Zapier",
          credentials: { token: connectorToken },
          config: {},
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSourceError(data.error ?? "Failed to connect source");
        setConnectingSource(false);
        return;
      }
      setSourceConnected(true);
      setConnectingSource(false);
      setStep(2);
    } catch {
      setSourceError("Network error. Please try again.");
      setConnectingSource(false);
    }
  }

  async function sendInvites() {
    const validEmails = inviteEmails.filter((e) => e.trim().length > 0);
    if (validEmails.length === 0) {
      setInviteError("Enter at least one email");
      return;
    }
    setInviting(true);
    setInviteError("");
    try {
      for (const email of validEmails) {
        const res = await fetch("/api/org/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), role: inviteRole }),
        });
        if (!res.ok) {
          const data = await res.json();
          setInviteError(data.error ?? `Failed to invite ${email}`);
          setInviting(false);
          return;
        }
      }
      setInvitesSent(true);
      setInviting(false);
    } catch {
      setInviteError("Network error. Please try again.");
      setInviting(false);
    }
  }

  function addEmailField() {
    setInviteEmails([...inviteEmails, ""]);
  }

  function updateEmail(i: number, value: string) {
    const next = [...inviteEmails];
    next[i] = value;
    setInviteEmails(next);
  }

  function removeEmail(i: number) {
    if (inviteEmails.length <= 1) return;
    setInviteEmails(inviteEmails.filter((_, idx) => idx !== i));
  }

  function skipToDashboard() {
    router.push("/platform");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground font-bold text-sm">N</span>
          </div>
          <h1 className="text-2xl font-bold">Welcome to Nexus</h1>
          <p className="text-muted-foreground mt-1">Set up your AI governance platform in a few steps</p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-3">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (i === 0 || (i === 1 && orgCreated) || (i === 2 && orgCreated)) {
                    setStep(i);
                  }
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  step === i
                    ? "bg-primary text-primary-foreground"
                    : step > i
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                )}
              >
                <s.icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn("w-6 h-0.5", step > i ? "bg-primary" : "bg-muted")} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Organization */}
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Create Your Organization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Organization Name <span className="text-destructive">*</span></Label>
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Acme Corp"
                  onKeyDown={(e) => e.key === "Enter" && createOrg()}
                />
              </div>
              {orgError && <p className="text-sm text-destructive">{orgError}</p>}
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={skipToDashboard}>
                  <SkipForward className="h-4 w-4 mr-1.5" />
                  Skip to Dashboard
                </Button>
                <Button onClick={createOrg} disabled={creatingOrg}>
                  {creatingOrg ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>
                  ) : (
                    <>Continue <ArrowRight className="h-4 w-4 ml-1.5" /></>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Connect Source */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Connect Your First Data Source</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose a source to start discovering AI assets in your organization.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setConnectorKind("github")}
                  className={cn(
                    "p-4 border rounded-lg text-center transition-colors",
                    connectorKind === "github"
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  )}
                >
                  <span className="text-2xl block mb-1">🐙</span>
                  <p className="text-sm font-medium">GitHub</p>
                  <p className="text-xs text-muted-foreground">Scan repos for AI usage</p>
                </button>
                <button
                  onClick={() => setConnectorKind("zapier")}
                  className={cn(
                    "p-4 border rounded-lg text-center transition-colors",
                    connectorKind === "zapier"
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  )}
                >
                  <span className="text-2xl block mb-1">⚡</span>
                  <p className="text-sm font-medium">Zapier</p>
                  <p className="text-xs text-muted-foreground">Import Zap AI steps</p>
                </button>
              </div>

              {connectorKind && (
                <div className="space-y-1.5">
                  <Label>
                    {connectorKind === "github" ? "Personal Access Token" : "API Key"}
                  </Label>
                  <Input
                    type="password"
                    value={connectorToken}
                    onChange={(e) => setConnectorToken(e.target.value)}
                    placeholder={
                      connectorKind === "github"
                        ? "ghp_xxxxxxxxxxxxxxxxxxxx"
                        : "zap_xxxxxxxxxxxxxxxxxxxx"
                    }
                  />
                </div>
              )}

              {sourceError && <p className="text-sm text-destructive">{sourceError}</p>}

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStep(0)}>
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Back
                  </Button>
                  <Button variant="ghost" size="sm" onClick={skipToDashboard}>
                    <SkipForward className="h-4 w-4 mr-1.5" />
                    Skip
                  </Button>
                </div>
                <Button
                  onClick={connectSource}
                  disabled={!connectorKind || !connectorToken || connectingSource}
                >
                  {connectingSource ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Connecting...</>
                  ) : (
                    <>Connect <ArrowRight className="h-4 w-4 ml-1.5" /></>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Invite Team */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Invite Your Team</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Invite colleagues to help manage your AI governance posture.
              </p>

              <div className="space-y-2">
                {inviteEmails.map((email, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => updateEmail(i, e.target.value)}
                      placeholder="colleague@company.com"
                    />
                    {inviteEmails.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEmail(i)}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        &times;
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addEmailField}>
                  + Add another
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label>Role</Label>
                <select
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="viewer">Viewer</option>
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}

              {invitesSent ? (
                <div className="space-y-4">
                  <p className="text-sm text-emerald-600 font-medium">Invitations sent successfully!</p>
                  <Button onClick={skipToDashboard} className="w-full">
                    Go to Dashboard <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                      <ArrowLeft className="h-4 w-4 mr-1.5" />
                      Back
                    </Button>
                    <Button variant="ghost" size="sm" onClick={skipToDashboard}>
                      <SkipForward className="h-4 w-4 mr-1.5" />
                      Skip
                    </Button>
                  </div>
                  <Button onClick={sendInvites} disabled={inviting}>
                    {inviting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                    ) : (
                      <>Send Invites <ArrowRight className="h-4 w-4 ml-1.5" /></>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
