"use client";

import { useEffect, useState } from "react";
import { Plus, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { OrgMember, Invitation } from "@/lib/types/platform";

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-primary/10 text-primary",
  admin: "bg-blue-500/10 text-blue-700",
  operator: "bg-yellow-500/10 text-yellow-700",
  viewer: "bg-muted text-muted-foreground",
};

export default function TeamPage() {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/org/members");
    const data = await res.json();
    setMembers(data.data?.members ?? []);
    setInvitations(data.data?.invitations ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  async function invite() {
    if (!email) {
      setError("Email is required");
      return;
    }
    setInviting(true);
    setError("");

    const res = await fetch("/api/org/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });

    const data = (await res.json()) as { error?: string };

    if (!res.ok) {
      setError(data.error ?? "Failed to send invitation");
      setInviting(false);
      return;
    }

    setEmail("");
    setInviting(false);
    toast.success(`Invitation sent to ${email}`);
    load();
  }

  async function changeRole(memberId: string, newRole: string) {
    setChangingRole(memberId);
    try {
      const res = await fetch(`/api/org/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) { toast.error("Failed to update role"); return; }
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId ? { ...m, role: newRole as OrgMember["role"] } : m
        )
      );
      toast.success("Role updated");
    } catch {
      toast.error("Failed to update role");
    } finally {
      setChangingRole(null);
    }
  }

  async function removeMember(memberId: string) {
    if (!confirm("Remove this team member? They will lose access to the organization."))
      return;
    setRemoving(memberId);
    try {
      const res = await fetch(`/api/org/members/${memberId}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Failed to remove member"); return; }
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast.success("Member removed");
    } catch {
      toast.error("Failed to remove member");
    } finally {
      setRemoving(null);
    }
  }

  async function cancelInvitation(invitationId: string) {
    setCancelling(invitationId);
    try {
      await fetch(`/api/org/invitations/${invitationId}`, { method: "DELETE" });
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
    } finally {
      setCancelling(null);
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-muted-foreground mt-1">
          Manage team members and their access levels
        </p>
      </div>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : (
            <div className="divide-y">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium">{(m as unknown as { user_email: string | null }).user_email ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">
                      Joined{" "}
                      {m.accepted_at
                        ? new Date(m.accepted_at).toLocaleDateString()
                        : "Pending"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.role === "owner" ? (
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[m.role]}`}
                      >
                        {m.role}
                      </span>
                    ) : (
                      <>
                        <select
                          className="px-2 py-1 border rounded text-xs bg-background"
                          value={m.role}
                          onChange={(e) => changeRole(m.id, e.target.value)}
                          disabled={changingRole === m.id}
                        >
                          <option value="viewer">Viewer</option>
                          <option value="operator">Operator</option>
                          <option value="admin">Admin</option>
                        </select>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeMember(m.id)}
                          disabled={removing === m.id}
                          className="text-muted-foreground hover:text-destructive"
                          title="Remove member"
                        >
                          {removing === m.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Expires {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize text-xs">
                      {inv.role}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      Pending
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => cancelInvitation(inv.id)}
                      disabled={cancelling === inv.id}
                      className="text-muted-foreground hover:text-destructive"
                      title="Cancel invitation"
                    >
                      {cancelling === inv.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Invite Team Member</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <select
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="viewer">Viewer — can view assets and reports</option>
              <option value="operator">Operator — can take actions on assets</option>
              <option value="admin">Admin — can manage connectors, policies, and team</option>
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={invite} disabled={inviting}>
            {inviting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1.5" />
                Send Invitation
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
