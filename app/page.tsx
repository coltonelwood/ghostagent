import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0f] text-white">

      {/* Nav */}
      <header className="border-b border-white/10 sticky top-0 z-50 backdrop-blur bg-[#0a0a0f]/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600">
              <span className="text-sm font-bold text-white">N</span>
            </div>
            <span className="font-semibold text-lg tracking-tight">Nexus</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-white/60">
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#connectors" className="hover:text-white transition-colors">Connectors</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth/login">
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
                Sign in
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
                Start Free →
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-24 pb-20 text-center">
        <Badge className="mb-6 bg-violet-600/20 text-violet-400 border-violet-600/30 border">
          AI Asset Management Platform
        </Badge>
        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.08]">
          Every AI agent
          <br />
          <span className="text-violet-400">in your company.</span>
          <br />
          Mapped. Owned. Governed.
        </h1>
        <p className="mx-auto mt-8 max-w-2xl text-lg text-white/60 leading-relaxed">
          Nexus connects to GitHub, AWS, GitLab, Zapier, n8n, and your HR systems
          to discover every AI script, automation, and LLM integration — then assigns
          ownership, scores risk, and enforces policy.
          <br className="hidden sm:block" />
          <span className="text-white/80"> Before your auditors find them first.</span>
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/auth/login">
            <Button size="lg" className="bg-violet-600 hover:bg-violet-700 text-white px-8 h-12 text-base">
              Start Free Scan →
            </Button>
          </Link>
          <Link href="/demo">
            <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 h-12 text-base px-8">
              View Live Demo
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-sm text-white/30">No credit card. Connects in 2 minutes.</p>
      </section>

      {/* Social proof numbers */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-5xl px-6 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { value: "10+", label: "Connectors" },
            { value: "65+", label: "AI detection patterns" },
            { value: "4", label: "Compliance frameworks" },
            { value: "< 10min", label: "First scan to results" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-bold text-white">{s.value}</div>
              <div className="text-sm text-white/40 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* The problem */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">Your engineers ship AI fast.<br />No one tracks where it goes.</h2>
          <p className="mt-4 text-white/50 max-w-xl mx-auto">Every quarter, more AI agents, automations, and LLM integrations are added to your stack. Most are never inventoried. Many outlive the engineers who built them.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              icon: "👻",
              title: "Ghost Agents",
              desc: "AI scripts still running in production — connected to your APIs, customer data, and payment systems — with no owner after their creator left.",
            },
            {
              icon: "⚕️",
              title: "PHI Exposure",
              desc: "LLM integrations processing patient records, claims, or health data without documented BAAs or compliance review.",
            },
            {
              icon: "🚨",
              title: "Audit Failure",
              desc: "SOC 2, ISO 42001, and EU AI Act auditors now ask for an AI system inventory. Most companies can't produce one.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
              <div className="text-3xl mb-4">{item.icon}</div>
              <h3 className="font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold">How Nexus works</h2>
            <p className="mt-3 text-white/50">Connect. Discover. Govern.</p>
          </div>
          <div className="grid sm:grid-cols-4 gap-6">
            {[
              { step: "01", title: "Connect your sources", desc: "GitHub, GitLab, AWS, Zapier, n8n, and HR systems. One-click setup." },
              { step: "02", title: "Discover everything", desc: "65+ detection patterns find LLM calls, ML models, automation workflows, and AI feature flags." },
              { step: "03", title: "Assign ownership", desc: "Cross-reference HR data to find who owns each asset. Flag orphaned systems automatically." },
              { step: "04", title: "Enforce policy", desc: "Set rules like 'all critical AI must have an owner' and auto-create tasks when violations are found." },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="text-xs font-mono text-violet-400 mb-3">{item.step}</div>
                <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Connectors */}
      <section id="connectors" className="mx-auto max-w-5xl px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">Connects to your entire stack</h2>
          <p className="mt-3 text-white/50">Not just GitHub. Every place your engineers ship AI.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { name: "GitHub", icon: "🐙", desc: "Repos & code search", status: "live" },
            { name: "GitLab", icon: "🦊", desc: "Self-hosted + cloud", status: "live" },
            { name: "AWS", icon: "☁️", desc: "Lambda, Bedrock, SageMaker", status: "live" },
            { name: "Zapier", icon: "⚡", desc: "AI workflow steps", status: "live" },
            { name: "n8n", icon: "🔄", desc: "Self-hosted automation", status: "live" },
            { name: "BambooHR", icon: "🌿", desc: "Employee ownership data", status: "live" },
            { name: "Rippling", icon: "👥", desc: "HR + offboarding", status: "live" },
            { name: "Azure", icon: "🔷", desc: "Azure OpenAI, DevOps", status: "soon" },
            { name: "GCP", icon: "🌐", desc: "Vertex AI, BigQuery", status: "soon" },
            { name: "Bitbucket", icon: "🪣", desc: "Atlassian repos", status: "soon" },
            { name: "Make", icon: "🔧", desc: "Automation scenarios", status: "soon" },
            { name: "Workday", icon: "📋", desc: "Enterprise HR", status: "soon" },
          ].map((c) => (
            <div key={c.name} className={`rounded-xl border p-4 ${c.status === "live" ? "border-white/10 bg-white/[0.03]" : "border-white/5 bg-white/[0.01] opacity-60"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{c.icon}</span>
                {c.status === "soon" && <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full">Soon</span>}
                {c.status === "live" && <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">Live</span>}
              </div>
              <div className="font-medium text-sm text-white">{c.name}</div>
              <div className="text-xs text-white/40 mt-0.5">{c.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Compliance */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold">Built for compliance</h2>
            <p className="mt-3 text-white/50">Every finding maps to the regulations your auditors care about.</p>
          </div>
          <div className="grid sm:grid-cols-4 gap-6">
            {[
              { name: "HIPAA", desc: "PHI exposure detection, BAA gap analysis", icon: "⚕️" },
              { name: "SOC 2", desc: "AI system inventory, access controls, change management", icon: "🛡️" },
              { name: "EU AI Act", desc: "Risk categorization, human oversight documentation", icon: "🇪🇺" },
              { name: "ISO 42001", desc: "AI management system controls", icon: "📋" },
            ].map((f) => (
              <div key={f.name} className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
                <div className="text-2xl mb-3">{f.icon}</div>
                <div className="font-semibold text-white mb-1">{f.name}</div>
                <div className="text-sm text-white/50">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-5xl px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">Simple pricing</h2>
          <p className="mt-3 text-white/50">Start free. Upgrade when you need more.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            {
              name: "Starter",
              price: "$499",
              per: "/month",
              desc: "For teams just getting started with AI governance.",
              features: ["Up to 3 connectors", "500 AI assets", "Basic risk scoring", "Email alerts", "SOC 2 report"],
              cta: "Start Free",
              highlight: false,
            },
            {
              name: "Professional",
              price: "$2,500",
              per: "/month",
              desc: "For companies serious about AI compliance.",
              features: ["Unlimited connectors", "Unlimited assets", "Full risk engine", "Policy enforcement", "All 4 compliance frameworks", "Slack + webhook alerts", "Priority support"],
              cta: "Start Free Trial",
              highlight: true,
            },
            {
              name: "Enterprise",
              price: "Custom",
              per: "",
              desc: "For large organizations with complex needs.",
              features: ["Multi-org support", "SSO / SAML", "Custom connectors", "Dedicated support", "SLA guarantee", "On-prem option"],
              cta: "Contact Us",
              highlight: false,
            },
          ].map((plan) => (
            <div key={plan.name} className={`rounded-xl border p-6 flex flex-col ${plan.highlight ? "border-violet-500/50 bg-violet-600/10" : "border-white/10 bg-white/[0.03]"}`}>
              {plan.highlight && <div className="text-xs font-semibold text-violet-400 mb-3 uppercase tracking-wider">Most Popular</div>}
              <div className="font-bold text-xl text-white">{plan.name}</div>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-4xl font-bold text-white">{plan.price}</span>
                <span className="text-white/40 mb-1">{plan.per}</span>
              </div>
              <p className="mt-2 text-sm text-white/50">{plan.desc}</p>
              <ul className="mt-6 space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                    <span className="text-emerald-400 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/login" className="mt-8">
                <Button className={`w-full ${plan.highlight ? "bg-violet-600 hover:bg-violet-700 text-white" : "bg-white/10 hover:bg-white/20 text-white border-0"}`}>
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold">Know what AI is running in your company.</h2>
          <p className="mt-4 text-white/50 text-lg">Connect your first source in 2 minutes. Free.</p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/login">
              <Button size="lg" className="bg-violet-600 hover:bg-violet-700 text-white px-10 h-12 text-base">
                Start Free Scan →
              </Button>
            </Link>
            <Link href="/demo">
              <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 h-12 px-10 text-base">
                View Demo First
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-violet-600">
              <span className="text-xs font-bold text-white">N</span>
            </div>
            <span className="text-sm font-semibold text-white/80">Nexus</span>
          </div>
          <div className="text-sm text-white/30">AI Asset Management for the enterprise.</div>
          <div className="flex gap-6 text-sm text-white/40">
            <Link href="/auth/login" className="hover:text-white transition-colors">Login</Link>
            <Link href="/demo" className="hover:text-white transition-colors">Demo</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
