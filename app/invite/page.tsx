"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type State = "loading" | "accepting" | "success" | "error" | "expired";

function InviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [state, setState] = useState<State>("loading");
  const [orgName, setOrgName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) { setState("error"); setErrorMsg("Invalid invitation link — missing token."); return; }

    // Fetch invite details
    fetch(`/api/invite?token=${token}`)
      .then(r => r.json())
      .then((d: { data?: { org_name: string }; error?: string }) => {
        if (d.error) { setState("expired"); setErrorMsg(d.error); }
        else { setOrgName(d.data?.org_name ?? ""); setState("accepting"); }
      })
      .catch(() => { setState("error"); setErrorMsg("Failed to load invitation."); });
  }, [token]);

  async function accept() {
    setState("loading");
    const res = await fetch("/api/invite/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json() as { error?: string };
    if (!res.ok) {
      setState("error");
      setErrorMsg(data.error ?? "Failed to accept invitation.");
    } else {
      setState("success");
      setTimeout(() => router.push("/platform"), 2000);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {state === "success" ? "Welcome aboard!" : "Team Invitation"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {state === "loading" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading invitation…</p>
            </div>
          )}

          {state === "accepting" && (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                You&apos;ve been invited to join <strong>{orgName}</strong> on Nexus.
              </p>
              <Button onClick={accept} className="w-full">
                Accept Invitation
              </Button>
            </div>
          )}

          {state === "success" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <p className="text-muted-foreground">
                You&apos;ve joined <strong>{orgName}</strong>. Redirecting you to the platform…
              </p>
            </div>
          )}

          {(state === "error" || state === "expired") && (
            <div className="flex flex-col items-center gap-3 py-4">
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-destructive font-medium">
                {state === "expired" ? "Invitation expired" : "Invalid invitation"}
              </p>
              <p className="text-muted-foreground text-sm">{errorMsg}</p>
              <Button variant="outline" onClick={() => router.push("/auth/login")}>
                Go to Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <InviteContent />
    </Suspense>
  );
}
