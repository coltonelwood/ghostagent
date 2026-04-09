import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center max-w-md space-y-5">
        <p className="text-sm font-mono text-muted-foreground">404</p>
        <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          This page doesn&apos;t exist or may have moved. If you followed a link, it may be outdated.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 transition-colors"
          >
            Go home
          </Link>
          <Link
            href="/platform"
            className="text-sm font-medium text-muted-foreground hover:text-foreground border rounded-lg px-4 py-2 transition-colors"
          >
            Open platform
          </Link>
        </div>
      </div>
    </div>
  );
}
