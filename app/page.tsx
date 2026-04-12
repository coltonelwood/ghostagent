import Link from "next/link";
import {
  ArrowRight,
  ShieldAlert,
  UserX,
  FileWarning,
  Database,
  Shield,
  ClipboardCheck,
  Plug,
  Activity,
  CheckCircle2,
  Lock,
  Search,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// --------------------------------------------------------------------------
// Data
// --------------------------------------------------------------------------

const CONNECTORS = [
  "GitHub",
  "GitLab",
  "AWS",
  "Azure",
  "GCP",
  "Zapier",
  "n8n",
  "Make",
  "BambooHR",
  "Rippling",
];

const FRAMEWORKS = [
  { abbr: "EU AI Act", desc: "Generate documentation for high-risk AI system registries" },
  { abbr: "SOC 2", desc: "Map findings to CC6.6, CC7.1, CC7.2, CC8.1 controls" },
  { abbr: "ISO 42001", desc: "Governance, impact assessment, and accountability artifacts" },
  { abbr: "NIST AI RMF", desc: "Risk identification and management aligned to the AI Risk Management Framework" },
];

const PROBLEMS = [
  {
    icon: ShieldAlert,
    title: "Shadow AI",
    body: "Teams are deploying AI agents, LLM integrations, and automation workflows without security review or documented oversight. If it's not in your inventory, you can't govern it.",
  },
  {
    icon: UserX,
    title: "Orphaned agents",
    body: "When creators leave the company, their AI systems keep running — connected to APIs, customer data, and cloud resources — with no owner on record.",
  },
  {
    icon: FileWarning,
    title: "Compliance gaps",
    body: "Regulators and auditors are asking about your AI systems. EU AI Act, SOC 2, and ISO 42001 assessments now expect a documented inventory most teams don't have.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Connect your sources",
    body: "Link GitHub, GitLab, AWS, Azure, GCP, Zapier, n8n, Make, and HR systems like BambooHR or Rippling. Credentials are encrypted with AES-256-GCM before storage.",
  },
  {
    n: "02",
    title: "Spekris scans for AI systems",
    body: "Scans repos for agent frameworks (CrewAI, AutoGen, LangGraph, LangChain), AI dependencies in package.json and requirements.txt, LLM API keys in .env files, and AI patterns in Dockerfiles and Terraform.",
  },
  {
    n: "03",
    title: "Review, govern, track",
    body: "Review discovered assets, classify by kind, set governance policies, and track compliance posture. Every discovery, change, and policy violation is logged in the audit trail.",
  },
];

const MODULES = [
  {
    icon: Database,
    title: "AI System Inventory",
    body: "Discover agents, pipelines, LLM integrations, and ML workflows across connected repos. Assets are classified by kind: agent, pipeline, workflow, script, or integration.",
  },
  {
    icon: Activity,
    title: "Risk Scoring",
    body: "Rule-based heuristic scoring across 10 dimensions — ownership, data sensitivity, environment, compliance gaps, and more. Every score has an explanation.",
  },
  {
    icon: UserX,
    title: "Ownership Tracking",
    body: "Cross-references with HR systems to assign and verify owners. Automatically detects orphaned AI when an owner leaves the company.",
  },
  {
    icon: Shield,
    title: "Policy Engine",
    body: "Define governance rules, auto-evaluate assets against them, and trigger alerts, quarantine asset records, or create tasks when violations occur.",
  },
  {
    icon: ClipboardCheck,
    title: "Compliance Support",
    body: "Generate documentation for EU AI Act, SOC 2, ISO 42001, and NIST AI RMF. Spekris supports your compliance efforts — it does not certify compliance.",
  },
  {
    icon: Search,
    title: "Audit Trail",
    body: "Every discovery, classification change, policy violation, and governance action is logged. Export structured evidence for your security team or assessor.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "First scan found 14 AI integrations we had no record of. Three had no owner — their authors had left the company months earlier.",
    name: "VP of Engineering",
    co: "Series B fintech, 180 engineers",
  },
  {
    quote:
      "When our SOC 2 auditor asked for an AI system inventory, we had nothing. We ran Spekris and had a structured report to share in under an hour.",
    name: "Head of Security",
    co: "Enterprise SaaS, 120 employees",
  },
  {
    quote:
      "We had a spreadsheet. It was always out of date. Now Spekris updates the inventory automatically whenever a new AI integration gets pushed to our repos.",
    name: "Engineering Manager",
    co: "Legal tech platform, 90 engineers",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "$499",
    period: "/month",
    description: "For teams starting an AI governance program.",
    features: [
      "Up to 3 connectors",
      "500 AI assets",
      "Risk scoring + ownership",
      "SOC 2 compliance report",
      "Email alerts",
      "API access",
    ],
    cta: "Start free trial",
    highlighted: false,
  },
  {
    name: "Professional",
    price: "$2,500",
    period: "/month",
    description: "For companies under active compliance pressure.",
    features: [
      "Unlimited connectors",
      "Unlimited assets",
      "Full policy engine",
      "EU AI Act, SOC 2, ISO 42001, NIST AI RMF",
      "Slack + webhook alerts",
      "Audit log export",
      "Priority support",
    ],
    cta: "Start free trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large organizations with complex requirements.",
    features: [
      "Multi-org management",
      "SSO / SAML",
      "Custom connector SDK",
      "Dedicated success engineer",
      "Uptime SLA",
      "Security review available",
    ],
    cta: "Talk to sales",
    highlighted: false,
  },
];

// --------------------------------------------------------------------------
// Product screenshot mock (rendered in CSS so we don't need an image asset)
// --------------------------------------------------------------------------

function ProductScreenshot() {
  return (
    <div className="relative rounded-xl border border-border bg-card p-4 shadow-xl">
      <div className="flex items-center gap-1.5 border-b border-border pb-3">
        <div className="size-2 rounded-full bg-destructive/60" />
        <div className="size-2 rounded-full bg-warning/60" />
        <div className="size-2 rounded-full bg-success/60" />
        <div className="mx-auto rounded-sm bg-muted px-3 py-0.5 font-mono text-[10px] text-muted-foreground">
          app.spekris.io / platform
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Overview</h3>
            <p className="text-[10px] text-muted-foreground">
              AI asset posture across 6 connected sources
            </p>
          </div>
          <div className="flex gap-1">
            <div className="h-5 rounded bg-muted px-2 text-[9px] leading-5">7d</div>
            <div className="h-5 rounded bg-primary/10 px-2 text-[9px] leading-5 text-primary">
              30d
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            { l: "Total assets", v: "247", tone: "text-foreground" },
            { l: "Critical", v: "14", tone: "text-destructive" },
            { l: "Orphaned", v: "6", tone: "text-warning" },
            { l: "Violations", v: "9", tone: "text-warning" },
          ].map((s) => (
            <div
              key={s.l}
              className="rounded-md border border-border bg-muted/30 p-2"
            >
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
                {s.l}
              </p>
              <p className={cn("mt-1 text-lg font-semibold nx-tabular", s.tone)}>
                {s.v}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Risk distribution
          </p>
          <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-destructive" style={{ width: "24%" }} />
            <div className="h-full bg-warning" style={{ width: "36%" }} />
            <div className="h-full bg-info" style={{ width: "28%" }} />
            <div className="h-full bg-success" style={{ width: "12%" }} />
          </div>
          <div className="mt-2 flex gap-3 text-[9px]">
            {[
              { label: "Critical", count: 14, dot: "bg-destructive" },
              { label: "High", count: 52, dot: "bg-warning" },
              { label: "Medium", count: 68, dot: "bg-info" },
              { label: "Low", count: 113, dot: "bg-success" },
            ].map((r) => (
              <div key={r.label} className="flex items-center gap-1">
                <span className={cn("size-1.5 rounded-full", r.dot)} />
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-semibold nx-tabular">{r.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-border">
          {[
            {
              name: "claims-fraud-v3",
              owner: "unassigned",
              risk: "Critical",
              tone: "text-destructive",
              dot: "bg-destructive",
            },
            {
              name: "nlu-triage-bert",
              owner: "achen (inactive)",
              risk: "Critical",
              tone: "text-destructive",
              dot: "bg-destructive",
            },
            {
              name: "ai-coding-suggestions",
              owner: "schen",
              risk: "High",
              tone: "text-warning",
              dot: "bg-warning",
            },
          ].map((row, i) => (
            <div
              key={row.name}
              className={cn(
                "flex items-center gap-3 px-2.5 py-2 text-[10px]",
                i > 0 && "border-t border-border",
              )}
            >
              <span className={cn("size-1.5 rounded-full", row.dot)} />
              <span className="flex-1 truncate font-medium">{row.name}</span>
              <span className="hidden w-24 truncate text-muted-foreground sm:inline">
                {row.owner}
              </span>
              <span className={cn("font-semibold", row.tone)}>{row.risk}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Page
// --------------------------------------------------------------------------

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded bg-primary">
              <span className="text-xs font-semibold text-primary-foreground">
                S
              </span>
            </div>
            <span className="text-[15px] font-semibold tracking-tight">Spekris</span>
          </div>

          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#product" className="hover:text-foreground transition-colors">
              Product
            </a>
            <a href="#connectors" className="hover:text-foreground transition-colors">
              Connectors
            </a>
            <a href="#compliance" className="hover:text-foreground transition-colors">
              Compliance
            </a>
            <a href="#pricing" className="hover:text-foreground transition-colors">
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/auth/login"
              className="hidden text-xs font-medium text-muted-foreground hover:text-foreground sm:inline"
            >
              Sign in
            </Link>
            <Link
              href="/demo"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              View demo
            </Link>
            <Link
              href="/auth/login"
              className={buttonVariants({ size: "sm" })}
            >
              Start free trial
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative border-b border-border">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-5 lg:py-24">
          <div className="space-y-6 lg:col-span-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              AI system visibility and control
            </div>
            <h1 className="text-[2.5rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              Know every AI system running in your company.
            </h1>
            <p className="max-w-xl text-base text-muted-foreground leading-relaxed">
              Spekris scans your GitHub, GitLab, and cloud environments to
              discover AI agents, LLM integrations, and automation workflows.
              It assigns ownership, scores risk, and generates documentation
              for the compliance frameworks your auditors care about.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/auth/login"
                className={cn(buttonVariants({ size: "lg" }), "h-11 px-6")}
              >
                Start scanning
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/demo"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-11 px-6",
                )}
              >
                See how it works
              </Link>
            </div>
            <p className="text-xs text-muted-foreground/70">
              No credit card required · First scan in under 5 minutes · Cancel anytime
            </p>
          </div>

          <div className="lg:col-span-3">
            <ProductScreenshot />
          </div>
        </div>
      </section>

      {/* Proof strip */}
      <section className="border-b border-border bg-muted/20">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Maps to
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {FRAMEWORKS.map((f) => (
                <span
                  key={f.abbr}
                  className="inline-flex h-6 items-center rounded-sm border border-border bg-card px-2 text-[11px] font-medium"
                >
                  {f.abbr}
                </span>
              ))}
            </div>
          </div>
          <div className="hidden h-6 w-px bg-border lg:block" />
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Connects to
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {CONNECTORS.map((c) => (
                <span
                  key={c}
                  className="inline-flex h-6 items-center rounded-sm border border-border bg-card px-2 text-[11px] text-muted-foreground"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-primary">
            The problem
          </div>
          <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Engineers ship AI faster than anyone can inventory it.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Every quarter, new agents, LLM integrations, and ML services land
            in production — often without security review, compliance sign-off, or
            documented ownership. When engineers leave, their systems don&apos;t.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {PROBLEMS.map((item) => (
              <div
                key={item.title}
                className="nx-surface flex flex-col gap-3 p-5"
              >
                <div className="flex size-9 items-center justify-center rounded-md border border-border bg-muted/40">
                  <item.icon className="size-4 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="product" className="border-b border-border bg-muted/10">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-primary">
            How it works
          </div>
          <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Three steps from zero visibility to a governed AI inventory.
          </h2>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div
                key={step.n}
                className="nx-surface flex flex-col gap-3 p-5"
              >
                <span className="nx-mono text-[11px] font-semibold text-primary">
                  Step {step.n}
                </span>
                <h3 className="text-base font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-primary">
            Features
          </div>
          <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Visibility, governance, and compliance in one platform.
          </h2>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m) => (
              <div
                key={m.title}
                className="nx-surface flex flex-col gap-3 p-5 transition-colors hover:border-border-strong"
              >
                <div className="flex size-9 items-center justify-center rounded-md border border-border bg-muted/40">
                  <m.icon className="size-4 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold tracking-tight">
                  {m.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {m.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Connectors detail */}
      <section id="connectors" className="border-b border-border bg-muted/10">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-primary">
            Connectors
          </div>
          <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Scan across code, cloud, automation, and HR.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            10+ integrations across the systems where AI ships. Connect repos,
            cloud accounts, automation platforms, and HR systems. A custom
            SDK for proprietary systems is available on Professional and Enterprise.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {CONNECTORS.map((name) => (
              <div
                key={name}
                className="nx-surface flex items-center gap-3 p-3"
              >
                <div className="flex size-8 items-center justify-center rounded-md border border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground">
                  {name.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-[13px] font-medium">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance */}
      <section id="compliance" className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-primary">
            Compliance
          </div>
          <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Documentation for the frameworks your auditors ask about.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Spekris generates compliance documentation mapped to specific controls
            across four frameworks, so you can hand structured evidence to your
            security team or assessor. Spekris supports your compliance efforts
            — it does not certify compliance.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {FRAMEWORKS.map((f) => (
              <div
                key={f.abbr}
                className="nx-surface flex items-start gap-4 p-5"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-[11px] font-semibold">
                  {f.abbr}
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold tracking-tight">
                    {f.abbr}
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-b border-border bg-muted/10">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-primary">
            What teams say
          </div>
          <h2 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            The first scan always finds something.
          </h2>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <blockquote
                key={t.name}
                className="nx-surface flex flex-col gap-5 p-5"
              >
                <p className="flex-1 text-[13px] leading-relaxed text-foreground">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <footer>
                  <div className="text-[13px] font-semibold">{t.name}</div>
                  <div className="text-[11px] text-muted-foreground">{t.co}</div>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-primary">
                Security
              </div>
              <h2 className="text-3xl font-semibold leading-tight tracking-tight">
                Security that holds up to scrutiny.
              </h2>
              <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
                Connector credentials are encrypted with AES-256-GCM before
                storage and are never returned to the frontend. API access is
                scoped to your organization with enforced RBAC. Sensitive
                actions write structured audit logs.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {[
                "AES-256-GCM credential encryption",
                "Organization-scoped RBAC",
                "Full audit trail",
                "SSRF protection",
                "Security headers + CSP",
                "No plaintext secrets",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-[12px]"
                >
                  <Lock className="size-3.5 text-success" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-b border-border bg-muted/10">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-primary">
            Pricing
          </div>
          <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Straightforward pricing. No gotchas.
          </h2>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  "flex flex-col gap-5 rounded-lg border p-6",
                  plan.highlighted
                    ? "border-primary/40 bg-card shadow-[0_0_0_1px_var(--primary)/40]"
                    : "border-border bg-card",
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">{plan.name}</h3>
                  {plan.highlighted && (
                    <span className="inline-flex h-5 items-center rounded-sm bg-primary/10 px-2 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      Most popular
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight">
                    {plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>

                <p className="text-[13px] text-muted-foreground">{plan.description}</p>

                <ul className="flex-1 space-y-2 border-t border-border pt-5">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-[13px] text-foreground"
                    >
                      <CheckCircle2 className="size-3.5 shrink-0 text-success mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/auth/login"
                  className={cn(
                    buttonVariants({
                      variant: plan.highlighted ? "default" : "outline",
                      size: "lg",
                    }),
                    "h-10 w-full",
                  )}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground/70">
            All plans include a 14-day free trial. No setup fees. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Start building your AI system inventory today.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Connect your first source in under five minutes.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/auth/login"
              className={cn(buttonVariants({ size: "lg" }), "h-11 px-6")}
            >
              Start scanning
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/demo"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-11 px-6",
              )}
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <div className="flex size-6 items-center justify-center rounded bg-primary">
              <span className="text-[10px] font-semibold text-primary-foreground">
                S
              </span>
            </div>
            <span className="text-sm font-semibold">Spekris</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="text-xs text-muted-foreground">
              AI Asset Management
            </span>
          </div>
          <nav className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link href="/demo" className="hover:text-foreground transition-colors">
              Live demo
            </Link>
            <Link href="/auth/login" className="hover:text-foreground transition-colors">
              Sign in
            </Link>
            <a href="#pricing" className="hover:text-foreground transition-colors">
              Pricing
            </a>
          </nav>
          <p className="text-xs text-muted-foreground/70">
            © 2026 Spekris. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
