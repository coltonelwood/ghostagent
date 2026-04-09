"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
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
        toast.error(data.error ?? "Failed to save settings");
      } else {
        toast.success("Settings saved");
        setGithubToken(""); // clear token field after save
        router.refresh();
      }
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>GitHub Configuration</CardTitle>
        <CardDescription>
          Connect your GitHub organization to scan for ghost agents
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Workspace Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="github_org">GitHub Organization</Label>
            <Input
              id="github_org"
              placeholder="your-org"
              value={githubOrg}
              onChange={(e) => setGithubOrg(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="github_token">
              GitHub Personal Access Token
            </Label>
            <Input
              id="github_token"
              type="password"
              placeholder={workspace.github_token ? "••••••••" : "ghp_..."}
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Needs <code>repo</code> and <code>read:org</code> scopes.
              {workspace.github_token && " Token is already saved."}
            </p>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
