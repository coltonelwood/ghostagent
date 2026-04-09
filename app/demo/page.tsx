import Link from "next/link";

// ─── DEMO DATA ─────────────────────────────────────────────────────────────
// Represents a realistic scan output from a healthcare tech company.

const FINDINGS = [
  {
    id: "1",
    name: "claims-fraud-v3",
    path: ".env.example",
    repo: "acme-corp/claims-engine",
    type: "ML Scoring Service",
    risk: "critical" as const,
    owner: null,
    owner_github: null,
    last_active: 247,
    services: ["postgres", "openai"],
    confidence: 94,
    frameworks: ["HIPAA", "SOC 2"],
    description: "Production ML model scoring every claim submission for fraud. Confidence threshold: 0.85.",
    finding: "No documented owner or model card. If this model drifts or produces biased outputs, claims are being approved or rejected with no human review and no accountability.",
  },
  {
    id: "2",
    name: "nlu-triage",
    path: "ml/nlu-triage/requirements.txt",
    repo: "acme-corp/ml-services",
    type: "Clinical NLP Model",
    risk: "critical" as const,
    owner: "achen@acme.com",
    owner_github: "achen",
    last_active: 203,
    services: ["postgres"],
    confidence: 96,
    frameworks: ["HIPAA", "EU AI Act"],
    description: "Fine-tuned Bio_ClinicalBERT model classifying urgency of patient messages. Runs as a FastAPI service.",
    finding: "Owner (@achen) has not committed in 203 days and may have left the company. A patient triage model with no active owner is a governance and patient safety risk.",
  },
  {
    id: "3",
    name: "prototype-chat/chat-server.ts",
    path: "experiments/prototype-chat/chat-server.ts",
    repo: "acme-corp/platform",
    type: "Prototype — No Auth",
    risk: "critical" as const,
    owner: "ajiang@acme.com",
    owner_github: "ajiang",
    last_active: 189,
    services: [],
    confidence: 97,
    frameworks: ["HIPAA"],
    description: "Patient-provider WebSocket chat prototype. No authentication. In-memory only. No audit logging.",
    finding: "If this prototype ever processed real patient data in this state, it may create significant HIPAA exposure. Original author inactive for 189 days.",
  },
  {
    id: "4",
    name: "ai-coding-suggestions",
    path: "experiments/feature-flags/flag-config.json",
    repo: "acme-corp/platform",
    type: "Active AI Feature — 20% Rollout",
    risk: "high" as const,
    owner: "schen@acme.com",
    owner_github: "schen",
    last_active: 91,
    services: [],
    confidence: 88,
    frameworks: ["HIPAA", "SOC 2"],
    description: "AI-powered ICD-10 and CPT billing code suggestions. Active at 20% rollout. Fine-tuned model.",
    finding: "No documented accuracy baseline. No human review step before codes are used. Inaccurate suggestions could create billing compliance risk.",
  },
  {
    id: "5",
    name: "run-anomaly-detection.ts",
    path: "cron/weekly/run-anomaly-detection.ts",
    repo: "acme-corp/claims-engine",
    type: "ML Cron Agent",
    risk: "high" as const,
    owner: "jliu@acme.com",
    owner_github: "jliu",
    last_active: 74,
    services: ["postgres", "slack", "sendgrid"],
    confidence: 91,
    frameworks: ["SOC 2"],
    description: "Weekly ML-based anomaly detection on all claims. Checks upcoding, duplicate billing, unusual volumes.",
    finding: "Owner is documented only in a code comment. If James Liu has left, there is no accountable owner for a system that makes compliance decisions every Sunday.",
  },
];

const RISK_CONFIG = {
  critical: { label: "Critical", dot: "bg-red-500", text: "text-red-400", border: "border-red-500/20 bg-red-500/[0.06]", badge: "bg-red-500/15 text-red-400 border-red-500/20" },
  high:     { label: "High",     dot: "bg-orange-400", text: "text-orange-400", border: "border-orange-500/20 bg-orange-500/[0.04]", badge: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
  medium:   { label: "Medium",   dot: "bg-yellow-400", text: "text-yellow-400", border: "border-yellow-500/20 bg-yellow-500/[0.04]", badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" },
  low:      { label: "Low",      dot: "bg-emerald-400", text: "text-emerald-400", border: "border-white/[0.06] bg-white/[0.02]", badge: "bg-white/[0.06] text-white/50 border-white/10" },
};

const FRAMEWORK_COLORS: Record<string, string> = {
  "HIPAA":       "bg-red-500/10 text-red-400 border-red-500/20",
  "SOC 2":       "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "EU AI Act":   "bg-violet-500/10 text-violet-400 border-violet-500/20",
  "ISO 42001":   "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
};

const SERVICE_COLORS: Record<string, string> = {
  postgres:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
  openai:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  slack:      "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  sendgrid:   "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

// ─── PAGE ──────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const critical = FINDINGS.filter((f) => f.risk === "critical").length;
  const unowned = FINDINGS.filter((f) => !f.owner).length;
  const stale = FINDINGS.filter((f) => f.last_active > 90).length;
  const hipaa = FINDINGS.filter((f) => f.frameworks.includes("HIPAA")).length;

  return (
    <div className="min-h-screen bg-[#07070c] text-white">

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#07070c]/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-violet-600">
              <span className="text-xs font-bold text-white">N</span>
            </div>
            <span className="text-sm font-semibold">Nexus</span>
            <span className="hidden sm:block text-xs text-white/25 border border-white/[0.08] rounded-full px-2 py-0.5">
              Sample scan — acme-corp
            </span>
          </div>
          <Link
            href="/auth/login"
            className="text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-4 py-2 transition-colors"
          >
            Scan your org →
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">

        {/* Scan summary */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-lg font-semibold">AI Asset Inventory — acme-corp</h1>
            <span className="text-xs text-white/30">Scanned 18 repos · 4 min 12 sec</span>
          </div>
          <p className="text-sm text-white/40">GitHub · AWS · Zapier · n8n · BambooHR</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Assets found",    value: FINDINGS.length, color: "text-white" },
            { label: "Critical risk",   value: critical,         color: "text-red-400" },
            { label: "HIPAA exposure",  value: hipaa,            color: "text-red-400" },
            { label: "Inactive owners", value: stale,            color: "text-orange-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-white/35 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Alert banner */}
        <div className="rounded-xl border border-red-500/25 bg-red-500/[0.06] px-5 py-3.5">
          <p className="text-sm text-red-300 leading-relaxed">
            <span className="font-semibold">{critical} critical findings</span> — {unowned > 0 ? `${unowned} asset${unowned > 1 ? "s" : ""} with no owner on record,` : ""} {hipaa} findings involve data covered by HIPAA. Review recommended before next audit.
          </p>
        </div>

        {/* Findings */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider">Findings</h2>
          {FINDINGS.map((f) => {
            const rc = RISK_CONFIG[f.risk];
            return (
              <div key={f.id} className={`rounded-2xl border p-5 space-y-4 ${rc.border}`}>

                {/* Header row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold border rounded-full px-2.5 py-1 ${rc.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${rc.dot}`} />
                        {rc.label}
                      </span>
                      <span className="text-xs text-white/30 border border-white/[0.07] rounded-full px-2.5 py-1">
                        {f.type}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-white">{f.name}</h3>
                    <p className="text-xs font-mono text-white/30 truncate">{f.repo} · {f.path}</p>
                  </div>

                  {/* Confidence */}
                  <div className="text-right shrink-0">
                    <div className="text-xs text-white/25">Detection confidence</div>
                    <div className="text-lg font-bold text-white/60">{f.confidence}%</div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-white/45">{f.description}</p>

                {/* Finding */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                  <p className="text-sm text-white/70 leading-relaxed">
                    <span className="font-medium text-white/90">Finding: </span>
                    {f.finding}
                  </p>
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-white/35">
                  {/* Owner */}
                  {f.owner ? (
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${f.last_active > 90 ? "bg-orange-400" : "bg-emerald-400"}`} />
                      <span>{f.owner}</span>
                      <span className={f.last_active > 90 ? "text-orange-400" : ""}>
                        · {f.last_active}d since last commit
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      <span className="text-red-400">No owner on record</span>
                    </div>
                  )}

                  {/* Frameworks */}
                  <div className="flex gap-1.5 flex-wrap">
                    {f.frameworks.map((fw) => (
                      <span key={fw} className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${FRAMEWORK_COLORS[fw] ?? "bg-white/5 text-white/40 border-white/10"}`}>
                        {fw}
                      </span>
                    ))}
                  </div>

                  {/* Services */}
                  {f.services.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {f.services.map((svc) => (
                        <span key={svc} className={`px-2 py-0.5 rounded-full border text-[11px] ${SERVICE_COLORS[svc] ?? "bg-white/5 text-white/40 border-white/10"}`}>
                          {svc}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-8 text-center space-y-4">
          <h2 className="text-xl font-semibold text-white">
            These findings are from a fictional company.
          </h2>
          <p className="text-white/45 text-sm max-w-lg mx-auto leading-relaxed">
            Connect your GitHub org and we&apos;ll run the same scan on your real repositories.
            Takes under 5 minutes. No agent to install.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/auth/login"
              className="h-11 px-8 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors inline-flex items-center"
            >
              Start free scan →
            </Link>
            <Link
              href="/"
              className="text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              Learn more about Nexus
            </Link>
          </div>
          <p className="text-xs text-white/20">No credit card. No install. Results in under 5 minutes.</p>
        </div>

      </div>
    </div>
  );
}
