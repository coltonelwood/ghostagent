"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for the authenticated platform surface.
 *
 * Deliberately never renders `error.message` directly — that string could
 * contain Supabase error text, stack fragments, or sensitive context. In
 * production we show a calm, generic message with the Error ID the user
 * can quote to support. In development we show the raw message so the
 * engineer can debug.
 */
export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Send to the server logs (instrumentation will forward to Sentry).
    console.error("[platform error]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="nx-surface flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-md border border-destructive/20 bg-destructive/10">
          <AlertTriangle className="size-5 text-destructive" />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            This page hit an error
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Something went wrong loading this screen. Our team has been
            notified. Try again in a moment — if it keeps happening, include
            the error ID below when contacting support.
          </p>
          {isDev && error.message && (
            <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-muted/30 p-2 text-left text-[11px] text-destructive">
              {error.message}
            </pre>
          )}
          {error.digest && (
            <p className="mt-3 nx-mono text-[11px] text-muted-foreground/80">
              Error ID: <span className="text-foreground">{error.digest}</span>
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="sm" onClick={reset}>
            Try again
          </Button>
          <Link
            href="/platform"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Return to overview
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
