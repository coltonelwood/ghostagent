import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-primary">
              <span className="text-sm font-bold text-primary-foreground">G</span>
            </div>
            <span className="font-semibold text-lg">GhostAgent</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/auth/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-24 text-center">
        <Badge variant="secondary" className="mb-4">
          Enterprise AI Security
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Find the ghost AI agents
          <br />
          <span className="text-muted-foreground">hiding in your org</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Engineers leave. Their AI automation scripts don&apos;t. GhostAgent scans
          your GitHub organization to find orphaned AI agents — with access to
          your APIs, customer data, and payment systems — before they become a
          breach.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/auth/login">
            <Button size="lg">Start Free Scan</Button>
          </Link>
          <Link href="#how-it-works">
            <Button variant="outline" size="lg">
              How It Works
            </Button>
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y bg-muted/50">
        <div className="mx-auto grid max-w-4xl grid-cols-3 gap-8 px-4 py-12 text-center">
          <div>
            <div className="text-3xl font-bold">73%</div>
            <div className="mt-1 text-sm text-muted-foreground">
              of orgs have orphaned AI scripts
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold">12</div>
            <div className="mt-1 text-sm text-muted-foreground">
              avg. ghost agents per org
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold">$4.2M</div>
            <div className="mt-1 text-sm text-muted-foreground">
              avg. cost of AI-related breach
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-4xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold">How It Works</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          Three steps to secure your organization from ghost AI agents
        </p>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {[
            {
              step: "1",
              title: "Connect GitHub",
              description:
                "Link your GitHub organization with a personal access token. We only need read access.",
            },
            {
              step: "2",
              title: "Run a Scan",
              description:
                "We search every repo for AI agent patterns — LangChain, OpenAI, Anthropic, and more.",
            },
            {
              step: "3",
              title: "Triage & Fix",
              description:
                "See every agent with its owner, risk level, and connected services. Decommission the dangerous ones.",
            },
          ].map((item) => (
            <Card key={item.step}>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  {item.step}
                </div>
                <CardTitle className="mt-3">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t bg-muted/50 px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold">Pricing</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Start with a free scan. Upgrade when you need continuous monitoring.
          </p>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Trial</CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold">Free</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>1 organization scan</li>
                  <li>Up to 25 agents detected</li>
                  <li>Basic risk classification</li>
                </ul>
                <Link href="/auth/login" className="mt-6 block">
                  <Button variant="outline" className="w-full">
                    Start Free
                  </Button>
                </Link>
              </CardContent>
            </Card>
            <Card className="border-primary">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>Pro</CardTitle>
                  <Badge>Popular</Badge>
                </div>
                <div className="mt-2">
                  <span className="text-3xl font-bold">$399</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>Unlimited scans</li>
                  <li>Unlimited agents</li>
                  <li>AI-powered risk analysis</li>
                  <li>Continuous monitoring</li>
                  <li>Priority support</li>
                </ul>
                <Link href="/auth/login" className="mt-6 block">
                  <Button className="w-full">Get Started</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
              <span className="text-xs font-bold text-primary-foreground">G</span>
            </div>
            <span className="text-sm text-muted-foreground">
              GhostAgent
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Built for enterprise security teams.
          </p>
        </div>
      </footer>
    </div>
  );
}
