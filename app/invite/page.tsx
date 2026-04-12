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
  // Derive the initial state from the token so we don't need to setState
  // synchronously inside an effect.
  const [state, setState] = useState<State>(token ? "loading" : "error");
  const [orgName, setOrgName] = useState("");
  const [errorMsg, setErrorMsg] = useState(
    token ? "" : "Invalid invitation link — missing token.",
  );

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    fetch(`/api/invite?token=${token}`)
      .then((r) => r.json())
      .then((d: { data?: { org_name: string }; error?: string }) => {
        if (cancelled) return;
        if (d.error) {
          setState("expired");
          setErrorMsg(d.error);
        } else {
          setOrgName(d.data?.org_name ?? "");
          setState("accepting");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setState("error");
        setErrorMsg("Failed to load invitation.");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function accept() {
    setState("loading");
    const res = await fetch("/api/invite/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    // If the user isn't signed in yet, bounce them through the magic-link
    // flow with a redirectTo back to this exact invite page so the token
    // survives the round trip. After they sign in and the callback
    // redirects them, they'll land here again and can click Accept.
    if (res.status === 401) {
      const returnPath = `/invite?token=${encodeURIComponent(token ?? "")}`;
      router.push(
        `/auth/login?redirectTo=${encodeURIComponent(returnPath)}`,
      );
      return;
    }

    const data = (await res.json()) as { error?: string };
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
