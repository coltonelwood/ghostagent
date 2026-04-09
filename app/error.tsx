"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
    // Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4 p-8">
          <div className="text-5xl">👻</div>
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground max-w-sm mx-auto">
            An unexpected error occurred. The error has been logged.
            {error.digest && (
              <span className="block text-xs mt-2 font-mono text-gray-400">
                Error ID: {error.digest}
              </span>
            )}
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={reset}>Try again</Button>
            <Button variant="outline" onClick={() => (window.location.href = "/")}>
              Go home
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
