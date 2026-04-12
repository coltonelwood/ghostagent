import Link from "next/link";

export default function ConsumerLandingPage() {
  return (
    <div className="flex flex-col items-center text-center">
      {/* Hero */}
      <div className="max-w-2xl space-y-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Stop cybercrime.
          <br />
          <span className="text-primary">Protect everyone.</span>
        </h1>
        <p className="text-lg text-muted-foreground">
          Got a scam text? Phishing email? Suspicious call? Report it in seconds.
          Your report instantly protects thousands of other people from the same attack.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/report"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            Report a threat
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-8 text-sm font-medium transition-colors hover:bg-muted"
          >
            View your dashboard
          </Link>
        </div>
      </div>

      {/* How it works */}
      <div className="w-full max-w-3xl space-y-8 border-t border-border pt-16">
        <h2 className="text-2xl font-bold">How it works</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="space-y-2 rounded-xl border border-border p-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span className="text-lg font-bold">1</span>
            </div>
            <h3 className="font-semibold">Report it</h3>
            <p className="text-sm text-muted-foreground">
              Paste a scam text, forward a phishing email, or share a suspicious URL.
              Takes 10 seconds.
            </p>
          </div>
          <div className="space-y-2 rounded-xl border border-border p-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span className="text-lg font-bold">2</span>
            </div>
            <h3 className="font-semibold">AI analyzes it</h3>
            <p className="text-sm text-muted-foreground">
              Our AI instantly identifies the attack pattern, matches it against known
              campaigns, and extracts the behavioral fingerprint.
            </p>
          </div>
          <div className="space-y-2 rounded-xl border border-border p-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span className="text-lg font-bold">3</span>
            </div>
            <h3 className="font-semibold">Everyone is protected</h3>
            <p className="text-sm text-muted-foreground">
              Your report enters the collective defense network. Thousands of people
              and companies are instantly immunized against that attack.
            </p>
          </div>
        </div>
      </div>

      {/* Stats placeholder */}
      <div className="w-full max-w-3xl space-y-4 border-t border-border py-16">
        <h2 className="text-2xl font-bold">The network is growing</h2>
        <p className="text-muted-foreground">
          Every person who reports a threat makes the entire network stronger.
          One detection = universal protection.
        </p>
      </div>
    </div>
  );
}
