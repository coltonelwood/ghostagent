"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center max-w-md space-y-5">
          <p className="text-sm font-mono text-muted-foreground">Error</p>
          <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            An unexpected error occurred. Our team has been notified.
            {error.digest && (
              <span className="block text-xs mt-2 font-mono text-muted-foreground/60 bg-muted px-2 py-1 rounded">
                Ref: {error.digest}
              </span>
            )}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 transition-colors"
            >
              Try again
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              className="text-sm font-medium text-muted-foreground hover:text-foreground border rounded-lg px-4 py-2 transition-colors"
            >
              Go home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
