import Link from "next/link";

export const metadata = {
  title: "GhostAgent — Protect Yourself from Cybercrime",
  description:
    "Report scams, get real-time protection, and help protect millions of people from cybercrime.",
};

export default function ConsumerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Simple top nav for consumers */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">G</span>
            </div>
            <span className="font-heading text-lg font-semibold">GhostAgent</span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              href="/dashboard"
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              href="/report"
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Report
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
