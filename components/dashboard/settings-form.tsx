"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink } from "lucide-react";
import type { Workspace } from "@/lib/types";

export function SettingsForm({ workspace }: { workspace: Workspace }) {
  const [githubOrg, setGithubOrg] = useState(workspace.github_org ?? "");
  const [githubToken, setGithubToken] = useState("");
  const [name, setName] = useState(workspace.name);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body: Record<string, string> = { name, github_org: githubOrg };
    if (githubToken) body.github_token = githubToken;
    try {
      const res = await fetch("/api/workspace/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save settings. Please try again.");
      } else {
        toast.success("Settings saved successfully.");
        setGithubToken("");
        router.refresh();
      }
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-6 space-y-6">
      <div>
        <h2 className="text-base font-semibold">GitHub Configuration</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Connect your GitHub organization to scan for AI assets.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Workspace name */}
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-sm font-medium">Workspace name</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
        </div>

        {/* GitHub org */}
        <div className="space-y-1.5">
          <label htmlFor="github_org" className="text-sm font-medium">GitHub organization</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground border bg-muted rounded-l-lg px-3 h-10 flex items-center">github.com /</span>
            <input
              id="github_org"
              placeholder="your-org-name"
              value={githubOrg}
              onChange={(e) => setGithubOrg(e.target.value)}
              className="flex-1 h-10 rounded-r-lg border border-l-0 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div>
          {workspace.github_org && (
            <p className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected to <strong>{workspace.github_org}</strong>
            </p>
          )}
        </div>

        {/* GitHub token */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="github_token" className="text-sm font-medium">Personal access token</label>
            <a
              href="https://github.com/settings/tokens/new?scopes=repo,read:org&description=Nexus+Scanner"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Create token <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <input
            id="github_token"
            type="password"
            placeholder={workspace.github_token ? "Token saved — enter a new one to replace it" : "ghp_xxxxxxxxxxxxxxxxxxxx"}
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            className="w-full h-10 rounded-lg border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
          <p className="text-xs text-muted-foreground">
            Requires <code className="bg-muted px-1 rounded">repo</code> and <code className="bg-muted px-1 rounded">read:org</code> scopes. Stored encrypted.
          </p>
          {workspace.github_token && !githubToken && (
            <p className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Token is saved and active
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="h-9 px-5 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium transition-colors"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
