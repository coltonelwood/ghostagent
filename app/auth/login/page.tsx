"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Allow only same-origin relative paths in the post-login redirect so a
 * crafted /auth/login?redirectTo=https://evil.com can't phish users.
 * Mirrors safeNextPath() in /app/auth/callback/route.ts.
 */
function safeRedirectPath(value: string | null): string | null {
  if (!value) return null;
  if (value.length > 200) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/^\/\w+:/.test(value)) return null;
  return value;
}

/**
 * Map of callback error slugs (set by /auth/callback/route.ts) to
 * friendly, actionable explanations. Keeps the login page from
 * rendering a raw error slug and gives the user a clear next step.
 */
const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  no_code: "The sign-in link didn't carry a valid code. Try requesting a new link below.",
  exchange_failed:
    "That sign-in link has already been used or has expired. Request a fresh one below.",
  provider_error:
    "Our authentication provider returned an error. Please request a new link and try again.",
};

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirectTo = searchParams.get("redirectTo");
  const safeRedirect = safeRedirectPath(rawRedirectTo);

  const callbackError = searchParams.get("error");
  const initialError = callbackError
    ? CALLBACK_ERROR_MESSAGES[callbackError] ??
      "We couldn't complete sign-in. Please request a new link below."
    : "";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(initialError);

  // Redirect already-authenticated users to their intended destination
  // (or /platform) — same safe-path check prevents off-site jumps.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(safeRedirect ?? "/platform");
    });
  }, [router, safeRedirect]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    // Pass the validated path into the magic-link callback so we land
    // back where we started after the auth round trip.
    const callback = new URL("/auth/callback", window.location.origin);
    if (safeRedirect) callback.searchParams.set("next", safeRedirect);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callback.toString(),
      },
    });
    setLoading(false);
    if (authError) {
      setError("Something went wrong. Please try again.");
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Back to home
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded bg-primary">
              <span className="text-[10px] font-semibold text-primary-foreground">
                N
              </span>
            </div>
            <span className="text-sm font-semibold">Nexus</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {sent ? (
            <div className="nx-surface flex flex-col items-center gap-4 px-8 py-10 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-success/10">
                <Check className="size-5 text-success" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">
                  Check your email
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  We sent a sign-in link to{" "}
                  <span className="font-medium text-foreground">{email}</span>.
                  Click the link to continue.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <div className="mb-8 text-center">
                <h1 className="text-xl font-semibold tracking-tight">
                  Sign in to Nexus
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Enter your work email. We&apos;ll send you a secure sign-in link.
                </p>
              </div>

              <div className="nx-surface p-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="email"
                      className="text-[12px] font-medium text-foreground"
                    >
                      Work email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>

                  {error && (
                    <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    disabled={loading || !email}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Sending link
                      </>
                    ) : (
                      <>Send sign-in link</>
                    )}
                  </Button>
                </form>

                <p className="mt-5 text-center text-[11px] text-muted-foreground/70">
                  By signing in you agree to our terms of service.
                </p>
              </div>

              <p className="mt-6 text-center text-xs text-muted-foreground">
                New to Nexus?{" "}
                <Link
                  href="/"
                  className="font-medium text-foreground hover:underline"
                >
                  Learn more
                </Link>
              </p>
            </>
          )}
        </div>
      </div>

      <footer className="border-t border-border py-6">
        <p className="text-center text-xs text-muted-foreground/70">
          Credentials encrypted with AES-256-GCM. SSRF-protected infrastructure.
        </p>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
