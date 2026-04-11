import Link from "next/link";

// ─── DATA ──────────────────────────────────────────────────────────────────

const CONNECTORS = [
  { name: "GitHub",    abbr: "GH",  category: "Code",       live: true  },
  { name: "GitLab",    abbr: "GL",  category: "Code",       live: true  },
  { name: "AWS",       abbr: "AWS", category: "Cloud",      live: true  },
  { name: "Azure",     abbr: "AZ",  category: "Cloud",      live: false },
  { name: "GCP",       abbr: "GCP", category: "Cloud",      live: false },
  { name: "Zapier",    abbr: "ZAP", category: "Automation", live: true  },
  { name: "n8n",       abbr: "n8n", category: "Automation", live: true  },
  { name: "Make",      abbr: "MK",  category: "Automation", live: false },
  { name: "BambooHR",  abbr: "BHR", category: "HR",         live: true  },
  { name: "Rippling",  abbr: "RP",  category: "HR",         live: true  },
  { name: "Workday",   abbr: "WD",  category: "HR",         live: false },
  { name: "Bitbucket", abbr: "BB",  category: "Code",       live: false },
];

const STEPS = [
  {
    n: "01",
    title: "Connect your sources",
    body: "Link GitHub, GitLab, AWS, Zapier, n8n, and your HR systems in minutes. Connector credentials are encrypted with AES-256-GCM before storage and are not persisted in plaintext.",
  },
  {
    n: "02",
    title: "Surface undocumented AI systems",
    body: "Nexus scans connected sources for LLM integrations, ML models, automation workflows, AI feature flags, and internal scoring services — surfacing assets that may not appear in any existing inventory.",
  },
  {
    n: "03",
    title: "Identify who owns what",
    body: "Cross-reference your HR data to find current owners. When engineers leave, their AI systems are automatically flagged as unowned and escalated to the right team.",
  },
  {
    n: "04",
    title: "Set rules. Get alerted. Stay covered.",
    body: "Define ownership requirements, PHI handling rules, and risk thresholds. When something violates a rule, Nexus creates a task, sends an alert, and logs it for audit review.",
  },
];

const FRAMEWORKS = [
  { name: "HIPAA",     abbr: "H",   color: "bg-red-900/40 text-red-300",    desc: "Flags LLM integrations that may be processing patient data without documented oversight — supporting your team in identifying potential PHI exposure risks." },
  { name: "SOC 2",    abbr: "S2",  color: "bg-blue-900/40 text-blue-300",   desc: "Helps produce the AI system inventory many SOC 2 Type II auditors expect. Findings reference CC6.6, CC7.1, CC7.2, and CC8.1 as applicable context." },
  { name: "EU AI Act",abbr: "EU",  color: "bg-violet-900/40 text-violet-300",desc: "Supports alignment with EU AI Act documentation requirements for high-risk systems — including risk categorization, oversight, and technical documentation (Articles 9–17)." },
  { name: "ISO 42001",abbr: "ISO", color: "bg-indigo-900/40 text-indigo-300",desc: "Helps support ISO/IEC 42001 controls: governance documentation, risk identification, impact assessment, and accountability tracking for AI systems." },
];

const TESTIMONIALS = [
  {
    quote: "First scan found 14 AI integrations we had no record of. Three were actively processing customer data with no owner - their authors had left the company months earlier.",
    name: "VP of Engineering",
    co: "Series B fintech, 180 engineers",
  },
  {
    quote: "When our SOC 2 auditor asked for an AI system inventory, we had nothing. We ran Nexus and had a structured report to share in under an hour. That conversation went a lot better than it would have otherwise.",
    name: "Head of Security",
    co: "Healthcare SaaS, 120 employees",
  },
  {
    quote: "We had a spreadsheet. It was always out of date. Now Nexus just updates it automatically whenever a new AI integration gets pushed.",
    name: "Engineering Manager",
    co: "Legal tech platform, 90 engineers",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "$499",
    period: "/mo",
    desc: "For teams starting their AI governance program.",
    features: [
      "Up to 3 connectors",
      "500 AI assets",
      "Risk scoring + ownership",
      "SOC 2 compliance report",
      "Email alerts",
      "API access",
    ],
    cta: "Start Free Trial",
    highlighted: false,
  },
  {
    name: "Professional",
    price: "$2,500",
    period: "/mo",
    desc: "For companies under active compliance pressure.",
    features: [
      "Unlimited connectors",
      "Unlimited assets",
      "Full policy engine",
      "All 4 compliance frameworks",
      "Slack + webhook alerts",
      "Audit log export",
      "Priority support",
    ],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For large organizations with complex requirements.",
    features: [
      "Multi-org management",
      "SSO / SAML",
      "Custom connector SDK",
      "Dedicated success engineer",
      "Uptime SLA",
      "Security review available",
    ],
    cta: "Talk to Sales",
    highlighted: false,
  },
];

// ─── PAGE ──────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#07070c] text-white antialiased">

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#07070c]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 shadow-lg shadow-violet-900/40">
              <span className="text-sm font-bold tracking-tight text-white">N</span>
            </div>
            <span className="text-base font-semibold tracking-tight">Nexus</span>
            <span className="hidden sm:inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-white/40">
              AI Asset Management
            </span>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/50">
            <a href="#platform" className="hover:text-white transition-colors duration-150">Platform</a>
            <a href="#connectors" className="hover:text-white transition-colors duration-150">Connectors</a>
            <a href="#compliance" className="hover:text-white transition-colors duration-150">Compliance</a>
            <a href="#pricing" className="hover:text-white transition-colors duration-150">Pricing</a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="hidden sm:block text-sm font-medium text-white/50 hover:text-white transition-colors duration-150">
              Sign in
            </Link>
            <Link href="/demo">
              <button className="text-sm font-medium text-white/70 hover:text-white border border-white/10 hover:border-white/20 rounded-lg px-4 py-2 transition-all duration-150">
                View demo
              </button>
            </Link>
            <Link href="/auth/login">
              <button className="text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-4 py-2 transition-colors duration-150 shadow-lg shadow-violet-900/30">
                Get started →
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
          <div className="h-[600px] w-[1000px] rounded-full bg-violet-600/10 blur-[120px] -translate-y-1/3" />
        </div>

        <div className="relative mx-auto max-w-5xl px-6 pt-28 pb-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-300 mb-8">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
            Maps findings to HIPAA, SOC 2, EU AI Act, and ISO 42001 controls
          </div>

          <h1 className="text-5xl sm:text-[72px] font-bold tracking-tight leading-[1.04] text-white">
            Your company runs on AI.
            <br />
            <span className="bg-gradient-to-r from-violet-400 to-violet-200 bg-clip-text text-transparent">
              Do you know what&apos;s running?
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-xl text-white/50 leading-relaxed font-light">
            Nexus scans your connected sources to surface AI agents, automations, and LLM
            integrations your team may not have fully inventoried — then assigns ownership,
            scores risk, and helps you enforce governance policy.
          </p>

          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/login">
              <button className="h-12 px-8 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-base transition-colors shadow-xl shadow-violet-900/40">
                Start free trial →
              </button>
            </Link>
            <Link href="/demo">
              <button className="h-12 px-8 rounded-xl border border-white/10 hover:border-white/20 text-white/80 hover:text-white font-medium text-base transition-all">
                See a live scan
              </button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-white/25">No credit card required · Connects in under 5 minutes · Cancel anytime</p>
        </div>
      </section>

      {/* ── TRUST BAR ───────────────────────────────────────────────────── */}
      <div className="border-y border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto max-w-5xl px-6 py-5 flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          {[
            { v: "10+", l: "Source connectors" },
            { v: "4",   l: "Compliance frameworks supported" },
            { v: "< 10 min", l: "First scan to results" },
            { v: "AES-256", l: "Credential encryption" },
            { v: "HIPAA", l: "PHI risk flagging" },
          ].map((s) => (
            <div key={s.l} className="flex items-center gap-3">
              <span className="text-xl font-bold text-white">{s.v}</span>
              <span className="text-sm text-white/30">{s.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── PROBLEM ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-28">
        <div className="mb-4 text-sm font-semibold uppercase tracking-widest text-violet-400">The problem</div>
        <h2 className="text-4xl sm:text-5xl font-bold leading-tight max-w-3xl">
          Engineers ship AI fast.
          <span className="text-white/30"> Nobody tracks where it goes.</span>
        </h2>
        <p className="mt-5 text-lg text-white/50 max-w-2xl leading-relaxed">
          Every quarter, AI agents, LLM integrations, and ML services are added to your stack - often
          without security review, compliance sign-off, or ownership documentation. When engineers leave,
          their systems don&apos;t.
        </p>

        <div className="mt-14 grid sm:grid-cols-3 gap-5">
          {[
            {
              dot: "bg-red-500",
              label: "Risk: Critical",
              labelColor: "text-red-400 bg-red-400/10 border-red-400/20",
              title: "Unowned AI agents",
              body: "Scripts and services still running in production - connected to your APIs, customer data, and payment systems - with no owner on record. They don\'t appear in any inventory.",
            },
            {
              dot: "bg-red-500",
              label: "Risk: Critical",
              labelColor: "text-red-400 bg-red-400/10 border-red-400/20",
              title: "Silent PHI exposure",
              body: "LLM integrations that may be processing patient records or health data without documented oversight — creating potential exposure if a BAA hasn\'t been established or if the integration wasn\'t security-reviewed.",
            },
            {
              dot: "bg-orange-400",
              label: "Risk: High",
              labelColor: "text-orange-400 bg-orange-400/10 border-orange-400/20",
              title: "Compliance gaps",
              body: "Many SOC 2, EU AI Act, and ISO 42001 assessments now include questions about AI systems. Most engineering teams don\'t have a complete inventory ready. Most compliance teams don\'t know to ask for one.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-7 hover:border-white/[0.12] transition-colors">
              <div className="flex items-start justify-between mb-5">
                <div className={`h-2.5 w-2.5 rounded-full mt-1 ${item.dot}`} />
                <span className={`text-xs font-semibold border px-2 py-0.5 rounded-full ${item.labelColor}`}>{item.label}</span>
              </div>
              <h3 className="font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-sm text-white/45 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PLATFORM ────────────────────────────────────────────────────── */}
      <section id="platform" className="border-y border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto max-w-5xl px-6 py-28">
          <div className="mb-4 text-sm font-semibold uppercase tracking-widest text-violet-400">How it works</div>
          <h2 className="text-4xl sm:text-5xl font-bold leading-tight max-w-2xl">
            Four steps to knowing what&apos;s running.
          </h2>
          <p className="mt-5 text-lg text-white/50 max-w-2xl">
            Most teams go from zero visibility to a complete AI asset inventory in under an hour.
          </p>

          <div className="mt-16 grid sm:grid-cols-2 gap-5">
            {STEPS.map((step) => (
              <div key={step.n} className="rounded-2xl border border-white/[0.07] bg-[#0d0d14] p-7">
                <div className="font-mono text-xs font-bold text-violet-400/60 mb-4">{step.n}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>

          {/* Feature pills */}
          <div className="mt-10 flex flex-wrap gap-3">
            {[
              "Asset Registry", "Risk Scoring", "Ownership Engine", "Policy Builder",
              "Compliance Reports", "Audit Logs", "Alert Delivery", "SDK Integration",
              "Drift Detection", "Orphan Alerts"
            ].map((f) => (
              <span key={f} className="text-xs font-medium text-white/50 bg-white/[0.04] border border-white/[0.07] rounded-full px-3 py-1.5">
                {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONNECTORS ──────────────────────────────────────────────────── */}
      <section id="connectors" className="mx-auto max-w-5xl px-6 py-28">
        <div className="mb-4 text-sm font-semibold uppercase tracking-widest text-violet-400">Connectors</div>
        <h2 className="text-4xl sm:text-5xl font-bold leading-tight max-w-2xl">
          Not just GitHub.<br />
          <span className="text-white/30">Your entire stack.</span>
        </h2>
        <p className="mt-5 text-lg text-white/50 max-w-2xl">
          AI gets shipped everywhere - in repos, cloud functions, automation platforms, and HR-connected workflows. Nexus covers all of it.
        </p>

        <div className="mt-14 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {CONNECTORS.map((c) => (
            <div key={c.name} className={`rounded-xl border p-4 flex flex-col items-center gap-2 text-center transition-colors ${
              c.live
                ? "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.14]"
                : "border-white/[0.04] bg-white/[0.01] opacity-40"
            }`}>
              <div className="h-8 w-8 rounded-lg bg-white/[0.07] flex items-center justify-center text-[10px] font-bold text-white/60">{c.abbr}</div>
              <span className="text-xs font-medium text-white/70">{c.name}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                c.live
                  ? "bg-emerald-400/10 text-emerald-400"
                  : "bg-white/5 text-white/25"
              }`}>
                {c.live ? "Live" : "Soon"}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-8 p-5 rounded-2xl border border-violet-500/20 bg-violet-500/[0.04]">
          <p className="text-sm text-white/60">
            <span className="font-semibold text-violet-300">Custom connector SDK</span> - instrument any internal tool or proprietary system. Available on Professional and Enterprise plans.
          </p>
        </div>
      </section>

      {/* ── COMPLIANCE ──────────────────────────────────────────────────── */}
      <section id="compliance" className="border-y border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto max-w-5xl px-6 py-28">
          <div className="mb-4 text-sm font-semibold uppercase tracking-widest text-violet-400">Compliance</div>
          <h2 className="text-4xl sm:text-5xl font-bold leading-tight max-w-2xl">
            Auditors are asking about AI.
            <span className="text-white/30"> Now you have a starting point.</span>
          </h2>
          <p className="mt-5 text-lg text-white/50 max-w-2xl">
            Nexus maps findings to the controls most commonly referenced in compliance frameworks your security team works with — giving you structured evidence to start a conversation, not a guarantee of certification.
          </p>

          <div className="mt-14 grid sm:grid-cols-2 gap-5">
            {FRAMEWORKS.map((f) => (
              <div key={f.name} className="rounded-2xl border border-white/[0.07] bg-[#0d0d14] p-7 flex gap-5">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${f.color}`}>{f.abbr}</div>
                <div>
                  <h3 className="font-semibold text-white mb-2">{f.name}</h3>
                  <p className="text-sm text-white/45 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 grid sm:grid-cols-3 gap-5">
            {[
              { title: "Automated evidence collection", body: "Every scan generates audit-ready evidence. Export structured reports for your assessors." },
              { title: "Control mapping", body: "Findings are automatically mapped to the specific controls they violate - not just flagged generically." },
              { title: "Gap tracking", body: "Track your control coverage over time. See which items have been addressed and which still need attention." },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
                <h4 className="text-sm font-semibold text-white mb-2">{item.title}</h4>
                <p className="text-sm text-white/40 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-28">
        <div className="mb-4 text-sm font-semibold uppercase tracking-widest text-violet-400">What teams say</div>
        <h2 className="text-4xl font-bold max-w-xl">The first scan always finds something.</h2>

        <div className="mt-14 grid sm:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 flex flex-col gap-6">
              <p className="text-white/60 text-sm leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
              <div>
                <div className="text-sm font-semibold text-white">{t.name}</div>
                <div className="text-xs text-white/30 mt-0.5">{t.co}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECURITY ────────────────────────────────────────────────────── */}
      <section className="border-y border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
            <div>
              <div className="mb-3 text-sm font-semibold uppercase tracking-widest text-violet-400">Security</div>
              <h2 className="text-2xl font-bold">Security that holds up to scrutiny.</h2>
              <p className="mt-2 text-white/40 max-w-lg text-sm leading-relaxed">
                Connector credentials are encrypted with AES-256-GCM before storage and are not returned to the frontend. API access is scoped to your organization with enforced RBAC. Sensitive actions write structured audit logs. Credentials are not stored in plaintext.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              {["AES-256-GCM credentials", "Organization-scoped RBAC", "Full audit trail", "No plaintext secrets", "SSRF protection", "Security headers"].map((s) => (
                <span key={s} className="text-xs text-white/50 bg-white/[0.04] border border-white/[0.07] rounded-full px-3 py-1.5">
                  ✓ {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────────────── */}
      <section id="pricing" className="mx-auto max-w-5xl px-6 py-28">
        <div className="mb-4 text-sm font-semibold uppercase tracking-widest text-violet-400">Pricing</div>
        <h2 className="text-4xl sm:text-5xl font-bold leading-tight">Straightforward pricing.</h2>
        <p className="mt-4 text-white/50 text-lg">Start with a free trial. No credit card required.</p>

        <div className="mt-14 grid sm:grid-cols-3 gap-5 items-start">
          {PLANS.map((plan) => (
            <div key={plan.name} className={`rounded-2xl border p-7 flex flex-col ${
              plan.highlighted
                ? "border-violet-500/40 bg-gradient-to-b from-violet-900/20 to-transparent"
                : "border-white/[0.07] bg-white/[0.02]"
            }`}>
              {plan.highlighted && (
                <div className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-4">Most popular</div>
              )}
              <div className="font-bold text-lg text-white">{plan.name}</div>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-4xl font-bold text-white">{plan.price}</span>
                <span className="text-white/30 text-sm mb-1">{plan.period}</span>
              </div>
              <p className="mt-2 text-sm text-white/40">{plan.desc}</p>
              <ul className="mt-7 space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/60">
                    <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/login" className="mt-8 block">
                <button className={`w-full h-11 rounded-xl font-semibold text-sm transition-colors ${
                  plan.highlighted
                    ? "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/30"
                    : "bg-white/[0.06] hover:bg-white/[0.10] text-white/80"
                }`}>
                  {plan.cta}
                </button>
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-white/25">
          All plans include a 14-day free trial. No setup fees. Cancel anytime.
        </p>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.06]">
        <div className="relative overflow-hidden mx-auto max-w-5xl px-6 py-28 text-center">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[400px] w-[700px] rounded-full bg-violet-600/10 blur-[100px]" />
          </div>
          <div className="relative">
            <h2 className="text-4xl sm:text-5xl font-bold leading-tight">
              Know what AI
              <br />
              is running in your company.
            </h2>
            <p className="mt-5 text-lg text-white/40">Connect your first source in under 5 minutes.</p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/login">
                <button className="h-12 px-10 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-base transition-colors shadow-xl shadow-violet-900/40">
                  Start free trial →
                </button>
              </Link>
              <Link href="/demo">
                <button className="h-12 px-10 rounded-xl border border-white/10 hover:border-white/20 text-white/70 hover:text-white font-medium text-base transition-all">
                  View a live scan
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto max-w-5xl px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="grid h-6 w-6 place-items-center rounded bg-violet-600">
              <span className="text-xs font-bold text-white">N</span>
            </div>
            <span className="text-sm font-semibold text-white/70">Nexus</span>
            <span className="text-white/20 text-sm">·</span>
            <span className="text-sm text-white/25">AI Asset Management</span>
          </div>
          <div className="flex items-center gap-8 text-sm text-white/30">
            <Link href="/demo" className="hover:text-white/60 transition-colors">Live demo</Link>
            <Link href="/auth/login" className="hover:text-white/60 transition-colors">Sign in</Link>
            <Link href="/auth/login" className="hover:text-white/60 transition-colors">Get started</Link>
          </div>
          <div className="text-xs text-white/15">© 2026 Nexus. All rights reserved.</div>
        </div>
      </footer>

    </div>
  );
}
