import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const DEMO_AGENTS = [
  {
    name: "claims-fraud-scorer",
    repo: "acme-corp/claims-engine",
    file_path: ".env.example",
    status: "ghost",
    risk_level: "critical",
    description: "ML scoring service (claims-fraud-v3) scores every claim submission for fraud. Confidence threshold: 0.85.",
    why_flagged: "Your team is running a fraud detection ML model in production with no documented owner or model card. If this model has drift or bias, claims are being silently approved or rejected with no human review.",
    owner_email: null,
    owner_github: null,
    days_since_commit: 247,
    services: ["postgres", "openai"],
    has_secrets: false,
    compliance_tags: ["HIPAA", "SOC2"],
    confidence_score: 94,
  },
  {
    name: "chat-server.ts",
    repo: "acme-corp/platform",
    file_path: "experiments/prototype-chat/chat-server.ts",
    status: "ghost",
    risk_level: "critical",
    description: "Patient-provider WebSocket chat server. No authentication. Messages stored in-memory only. No HIPAA audit log.",
    why_flagged: "This prototype handles patient messages with no auth, no audit trail, and no persistence. If it ever ran against real patient data, it\'s a reportable HIPAA breach. Original author may have left the company.",
    owner_email: "ajiang@acme.com",
    owner_github: "ajiang",
    days_since_commit: 189,
    services: [],
    has_secrets: false,
    compliance_tags: ["HIPAA"],
    confidence_score: 97,
  },
  {
    name: "ai-coding-suggestions",
    repo: "acme-corp/platform",
    file_path: "experiments/feature-flags/flag-config.json",
    status: "active",
    risk_level: "high",
    description: "AI-powered ICD-10 and CPT billing code suggestions. Active at 20% rollout. Fine-tuned model. No human review gate.",
    why_flagged: "An AI system is actively suggesting billing codes to providers. Wrong codes mean fraudulent billing — even if unintentional. No accuracy benchmark is documented and no human review is required before submission.",
    owner_email: "schen@acme.com",
    owner_github: "schen",
    days_since_commit: 91,
    services: [],
    has_secrets: false,
    compliance_tags: ["HIPAA", "SOC2"],
    confidence_score: 88,
  },
  {
    name: "nlu-triage",
    repo: "acme-corp/ml-services",
    file_path: "ml/nlu-triage/requirements.txt",
    status: "active",
    risk_level: "critical",
    description: "Fine-tuned Bio_ClinicalBERT model classifying urgency of patient messages. Runs as a FastAPI service.",
    why_flagged: "A clinical NLP model is processing patient messages and categorizing them by urgency. The original author (@achen) may have left. If this model misclassifies an urgent message and a patient is harmed, there is no named owner accountable.",
    owner_email: "achen@acme.com",
    owner_github: "achen",
    days_since_commit: 203,
    services: ["postgres"],
    has_secrets: false,
    compliance_tags: ["HIPAA", "EU_AI_ACT"],
    confidence_score: 96,
  },
  {
    name: "run-anomaly-detection.ts",
    repo: "acme-corp/claims-engine",
    file_path: "cron/weekly/run-anomaly-detection.ts",
    status: "active",
    risk_level: "high",
    description: "Weekly cron job that runs ML-based anomaly detection on all claims. Checks upcoding, duplicate billing, unusual volumes.",
    why_flagged: "This AI system makes compliance decisions autonomously every Sunday. The owner is noted only in a code comment — if James Liu left, there is no accountable owner for a system that triggers compliance alerts.",
    owner_email: "jliu@acme.com",
    owner_github: "jliu",
    days_since_commit: 74,
    services: ["postgres", "slack", "sendgrid"],
    has_secrets: false,
    compliance_tags: ["SOC2"],
    confidence_score: 91,
  },
];

const SERVICE_COLORS: Record<string, string> = {
  stripe: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  sendgrid: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  salesforce: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  slack: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  postgres: "bg-blue-600/20 text-blue-400 border-blue-600/30",
  mongodb: "bg-green-500/20 text-green-300 border-green-500/30",
  hubspot: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  redis: "bg-red-500/20 text-red-300 border-red-500/30",
  aws: "bg-yellow-600/20 text-yellow-400 border-yellow-600/30",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "ghost") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 border text-xs">Unowned</Badge>;
  if (status === "orphaned") return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border text-xs">Owner departed</Badge>;
  return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border text-xs">Active</Badge>;
}

function RiskBadge({ level }: { level: string }) {
  if (level === "critical") return <Badge className="bg-red-600/50 text-red-200 border-red-500 border text-xs font-semibold">Critical</Badge>;
  if (level === "high") return <Badge className="bg-orange-900/50 text-orange-300 border-orange-700 border text-xs">High</Badge>;
  if (level === "medium") return <Badge className="bg-yellow-900/50 text-yellow-400 border-yellow-700 border text-xs">Medium</Badge>;
  return <Badge className="bg-gray-800 text-gray-400 border-gray-700 border text-xs">Low</Badge>;
}

export default function DemoPage() {
  const critical = DEMO_AGENTS.filter((a) => a.risk_level === "critical").length;
  const ghosts = DEMO_AGENTS.filter((a) => a.status === "ghost").length;
  const highRisk = DEMO_AGENTS.filter((a) => a.risk_level === "high" || a.risk_level === "critical").length;
  const hipaa = DEMO_AGENTS.filter((a) => (a.compliance_tags ?? []).includes("HIPAA")).length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-violet-600">
              <span className="text-xs font-bold text-white">N</span>
            </div>
            <span className="text-base font-semibold">Nexus</span>
            <span className="text-xs font-medium text-white/40 border border-white/10 rounded-full px-2 py-0.5">demo</span>
          </div>
          <Link href="/login">
            <Button size="sm">Scan Your Org Free →</Button>
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "AI Assets Found", value: DEMO_AGENTS.length, color: "text-white" },
            { label: "Critical Risk", value: critical, color: "text-red-400" },
            { label: "HIPAA Exposure", value: hipaa, color: "text-red-400" },
            { label: "Unowned Assets", value: ghosts, color: "text-yellow-400" },
          ].map((stat) => (
            <Card key={stat.label} className="bg-gray-900 border-gray-800">
              <CardContent className="p-4 text-center">
                <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-gray-500 text-sm mt-1">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 text-red-300 text-sm">
          <strong>{critical} critical findings</strong> — includes a clinical NLP model processing patient messages with no accountable owner, and a production ML model with no documented accuracy baseline. {hipaa} findings involve HIPAA-covered data.
        </div>

        {/* Agent cards */}
        <div className="space-y-4">
          {DEMO_AGENTS.map((agent) => (
            <Card
              key={agent.name}
              className={`bg-gray-900 border ${
                agent.status === "ghost" ? "border-red-700/60" :
                agent.status === "orphaned" ? "border-yellow-700/60" :
                "border-gray-800"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={agent.status} />
                      <RiskBadge level={agent.risk_level} />
                      {agent.has_secrets && (
                        <Badge className="bg-red-900/50 text-red-400 border-red-700 border text-xs">
                          🔑 Secrets detected
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-white font-semibold mt-2 text-lg">{agent.name}</h3>
                    <p className="text-gray-500 text-xs font-mono">
                      {agent.repo} / {agent.file_path}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <p className="text-gray-400 text-xs">{agent.description}</p>

                {/* Why This Matters — plain English for decision makers */}
                {'why_flagged' in agent && agent.why_flagged && (
                  <div className="bg-red-950/40 border border-red-800/40 rounded p-3">
                    <p className="text-red-300 text-xs leading-relaxed">
                      <span className="font-semibold text-red-200">Why this matters: </span>
                      {agent.why_flagged as string}
                    </p>
                  </div>
                )}

                {/* Compliance tags */}
                {'compliance_tags' in agent && (agent.compliance_tags as string[]).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-gray-500 text-xs">Compliance:</span>
                    {(agent.compliance_tags as string[]).map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded text-xs border bg-red-950/40 text-red-300 border-red-700/40">{tag}</span>
                    ))}
                    {'confidence_score' in agent && (
                      <span className="text-gray-500 text-xs ml-auto">{agent.confidence_score as number}% confidence</span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 text-xs">
                  {agent.owner_email ? (
                    <span className="text-gray-400">
                      Owner: <span className="text-gray-200">{agent.owner_email}</span>
                      {" "}·{" "}
                      <span className={agent.days_since_commit > 90 ? "text-red-400 font-medium" : "text-gray-400"}>
                        {agent.days_since_commit === 999 ? "never active" : `${agent.days_since_commit} days since last commit`}
                      </span>
                    </span>
                  ) : (
                    <span className="text-yellow-400">No owner on record</span>
                  )}
                </div>

                {agent.services.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {agent.services.map((svc) => (
                      <span
                        key={svc}
                        className={`px-2 py-0.5 rounded text-xs border font-medium ${
                          SERVICE_COLORS[svc] || "bg-gray-700 text-gray-300 border-gray-600"
                        }`}
                      >
                        {svc}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <Card className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-purple-700/50">
          <CardContent className="p-8 text-center space-y-4">
            <h2 className="text-2xl font-bold text-white">
              This is what we find in real GitHub orgs.
            </h2>
            <p className="text-gray-300 max-w-xl mx-auto">
              Run a free scan on yours. 90 seconds. No install. 
              Just your GitHub org name and a read-only token.
            </p>
            <Link href="/login">
              <Button size="lg" className="mt-2 bg-white text-gray-900 hover:bg-gray-100 font-semibold px-8">
                Scan Your GitHub Org Free →
              </Button>
            </Link>
            <p className="text-gray-500 text-sm">No credit card. Free scan included.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
