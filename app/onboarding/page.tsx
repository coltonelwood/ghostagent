"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
  Plug,
  Code,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STEPS = [
  { n: 1, label: "Organization" },
  { n: 2, label: "Connect source" },
  { n: 3, label: "Invite team" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [orgCreated, setOrgCreated] = useState(false);
  const [orgError, setOrgError] = useState("");

  const [connectorKind, setConnectorKind] = useState<"github" | "zapier" | null>(
    null,
  );
  const [connectorToken, setConnectorToken] = useState("");
  const [githubOrg, setGithubOrg] = useState("");
  const [connectingSource, setConnectingSource] = useState(false);
  const [sourceError, setSourceError] = useState("");

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
        method: "PATCH",
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

    let credentials: Record<string, string>;
    let config: Record<string, string> = {};
    let name: string;

    if (connectorKind === "github") {
      if (!githubOrg.trim()) {
        setSourceError("Enter your GitHub organization name");
        return;
      }
      if (!connectorToken.trim()) {
        setSourceError("Enter a GitHub personal access token");
        return;
      }
      credentials = { token: connectorToken.trim(), org: githubOrg.trim() };
      config = { org: githubOrg.trim() };
      name = `GitHub — ${githubOrg.trim()}`;
    } else {
      if (!connectorToken.trim()) {
        setSourceError("Enter a Zapier API key");
        return;
      }
      credentials = { apiKey: connectorToken.trim() };
      name = "Zapier";
    }

    setConnectingSource(true);
    setSourceError("");
    try {
      const res = await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: connectorKind, name, credentials, config }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSourceError(
          data.error ??
            "We couldn't verify those credentials. Please check and try again.",
        );
        setConnectingSource(false);
        return;
      }
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
        const res = await fetch("/api/org/invite", {
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

  function updateEmail(i: number, value: string) {
    setInviteEmails((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  }

  function removeEmail(i: number) {
    if (inviteEmails.length <= 1) return;
    setInviteEmails((prev) => prev.filter((_, idx) => idx !== i));
  }

  function skipToDashboard() {
    router.push("/platform");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded bg-primary">
              <span className="text-[10px] font-semibold text-primary-foreground">
                N
              </span>
            </div>
            <span className="text-sm font-semibold">Nexus</span>
          </Link>
          <button
            type="button"
            onClick={skipToDashboard}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now →
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-6 py-12">
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Let&apos;s get you set up
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Takes about three minutes. You can add more sources any time.
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => {
              const complete = i < step;
              const active = i === step;
              return (
                <div key={s.n} className="flex flex-1 items-center gap-2">
                  <div
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      complete &&
                        "bg-success text-success-foreground",
                      active && "bg-primary text-primary-foreground",
                      !complete && !active && "bg-muted text-muted-foreground",
                    )}
                  >
                    {complete ? <Check className="size-3" /> : s.n}
                  </div>
                  <span
                    className={cn(
                      "text-[12px] font-medium",
                      active
                        ? "text-foreground"
                        : complete
                          ? "text-muted-foreground"
                          : "text-muted-foreground/60",
                    )}
                  >
                    {s.label}
                  </span>
                  {i < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "h-px flex-1",
                        complete ? "bg-success/60" : "bg-border",
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step 1: Organization */}
          {step === 0 && (
            <div className="nx-surface space-y-5 p-6">
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  Name your organization
                </h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  This is the workspace your team will join.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium">
                  Organization name
                </label>
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Acme Corp"
                  onKeyDown={(e) => e.key === "Enter" && createOrg()}
                />
              </div>

              {orgError && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
                  {orgError}
                </div>
              )}

              <div className="flex items-center justify-end">
                <Button
                  size="sm"
                  onClick={createOrg}
                  disabled={creatingOrg}
                >
                  {creatingOrg ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Creating
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Connect Source */}
          {step === 1 && (
            <div className="nx-surface space-y-5 p-6">
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  Connect your first source
                </h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Pick a quick option below to finish onboarding in one screen,
                  or{" "}
                  <Link
                    href="/platform/connectors"
                    className="font-medium text-primary hover:underline"
                  >
                    browse all 10 sources
                  </Link>{" "}
                  — GitHub, GitLab, AWS, Azure, GCP, Zapier, n8n, Make,
                  BambooHR, Rippling.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    kind: "github" as const,
                    label: "GitHub",
                    body: "Scan repos for AI code",
                    icon: Code,
                  },
                  {
                    kind: "zapier" as const,
                    label: "Zapier",
                    body: "Import AI-powered Zaps",
                    icon: Zap,
                  },
                ].map((opt) => {
                  const active = connectorKind === opt.kind;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.kind}
                      type="button"
                      onClick={() => setConnectorKind(opt.kind)}
                      className={cn(
                        "flex items-start gap-3 rounded-md border p-3 text-left transition-colors",
                        active
                          ? "border-primary/50 bg-primary/5"
                          : "border-border hover:border-border-strong",
                      )}
                    >
                      <div className="flex size-8 items-center justify-center rounded-md border border-border bg-muted/40">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold">{opt.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {opt.body}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {connectorKind === "github" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium">
                      GitHub organization
                    </label>
                    <Input
                      value={githubOrg}
                      onChange={(e) => setGithubOrg(e.target.value)}
                      placeholder="my-company"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      As it appears in{" "}
                      <span className="nx-mono">github.com/my-company</span>.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium">
                      Personal access token
                    </label>
                    <Input
                      type="password"
                      value={connectorToken}
                      onChange={(e) => setConnectorToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Needs <span className="nx-mono">repo</span> read scope.
                      Encrypted with AES-256-GCM before storage.
                    </p>
                  </div>
                </div>
              )}

              {connectorKind === "zapier" && (
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium">API key</label>
                  <Input
                    type="password"
                    value={connectorToken}
                    onChange={(e) => setConnectorToken(e.target.value)}
                    placeholder="zap_xxxxxxxxxxxxxxxxxxxx"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Zapier Settings → Developer → API Key.
                  </p>
                </div>
              )}

              {sourceError && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
                  {sourceError}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep(0)}
                  >
                    <ArrowLeft className="size-3.5" />
                    Back
                  </Button>
                  <button
                    type="button"
                    onClick={skipToDashboard}
                    className="text-[12px] text-muted-foreground hover:text-foreground"
                  >
                    Skip for now
                  </button>
                </div>
                <Button
                  size="sm"
                  onClick={connectSource}
                  disabled={
                    !connectorKind ||
                    !connectorToken ||
                    (connectorKind === "github" && !githubOrg) ||
                    connectingSource
                  }
                >
                  {connectingSource ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Verifying
                    </>
                  ) : (
                    <>
                      Connect
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Invite Team */}
          {step === 2 && (
            <div className="nx-surface space-y-5 p-6">
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  Invite your team
                </h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Bring colleagues in to help manage AI governance. You can
                  skip this and invite them later.
                </p>
              </div>

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
                        className="shrink-0 text-muted-foreground"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setInviteEmails([...inviteEmails, ""])}
                  className="text-muted-foreground"
                >
                  + Add another
                </Button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium">Role</label>
                <select
                  className="h-8 w-full rounded-md border border-border bg-transparent px-2 text-[13px]"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="viewer">Viewer — read-only access</option>
                  <option value="operator">Operator — can act on findings</option>
                  <option value="admin">Admin — full access</option>
                </select>
              </div>

              {inviteError && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
                  {inviteError}
                </div>
              )}

              {invitesSent ? (
                <div className="space-y-4">
                  <div className="rounded-md border border-success/20 bg-success/10 px-3 py-2 text-[12px] text-success">
                    Invitations sent successfully.
                  </div>
                  <Button size="sm" className="w-full" onClick={skipToDashboard}>
                    Go to dashboard
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep(1)}
                    >
                      <ArrowLeft className="size-3.5" />
                      Back
                    </Button>
                    <button
                      type="button"
                      onClick={skipToDashboard}
                      className="text-[12px] text-muted-foreground hover:text-foreground"
                    >
                      Skip for now
                    </button>
                  </div>
                  <Button size="sm" onClick={sendInvites} disabled={inviting}>
                    {inviting ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Sending
                      </>
                    ) : (
                      <>
                        Send invites
                        <ArrowRight className="size-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
