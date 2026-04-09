import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const DEMO_AGENTS = [
  {
    name: "billing-reconciler",
    repo: "acme-corp/payments-service",
    file_path: "agents/billing_reconciler.py",
    status: "ghost",
    risk_level: "high",
    description: "Processes overdue invoice reminders and triggers Stripe payment retries automatically.",
    owner_email: "james.wu@acme.com",
    owner_github: "jameswu",
    days_since_commit: 142,
    services: ["stripe", "postgres", "sendgrid"],
    has_secrets: true,
  },
  {
    name: "customer-onboarding-agent",
    repo: "acme-corp/crm-tools",
    file_path: "src/agents/onboarding.ts",
    status: "active",
    risk_level: "medium",
    description: "Sends welcome email sequences to new trial users via SendGrid and logs activity to HubSpot.",
    owner_email: "sarah.kim@acme.com",
    owner_github: "sarahkim",
    days_since_commit: 8,
    services: ["sendgrid", "hubspot"],
    has_secrets: false,
  },
  {
    name: "data-sync-prod",
    repo: "acme-corp/integrations",
    file_path: "sync/data_sync_prod.py",
    status: "orphaned",
    risk_level: "high",
    description: "Syncs customer records between MongoDB and Salesforce on a daily schedule.",
    owner_email: null,
    owner_github: null,
    days_since_commit: 999,
    services: ["mongodb", "salesforce"],
    has_secrets: false,
  },
  {
    name: "support-ticket-classifier",
    repo: "acme-corp/support",
    file_path: "agents/classifier.ts",
    status: "active",
    risk_level: "low",
    description: "Classifies incoming support tickets and assigns priority labels using GPT-4o.",
    owner_email: "miguel.torres@acme.com",
    owner_github: "mtorres",
    days_since_commit: 3,
    services: [],
    has_secrets: false,
  },
  {
    name: "invoice-generator-v2",
    repo: "acme-corp/billing",
    file_path: "scripts/invoice_gen_v2.py",
    status: "ghost",
    risk_level: "high",
    description: "Generates and sends PDF invoices via Stripe, posts confirmation to Slack channel.",
    owner_email: "priya.nair@acme.com",
    owner_github: "pnair",
    days_since_commit: 67,
    services: ["stripe", "slack"],
    has_secrets: true,
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
  if (status === "ghost") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 border">👻 GHOST</Badge>;
  if (status === "orphaned") return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border">⚠️ ORPHANED</Badge>;
  return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border">✅ ACTIVE</Badge>;
}

function RiskBadge({ level }: { level: string }) {
  if (level === "high") return <Badge className="bg-red-900/50 text-red-400 border-red-700 border text-xs">HIGH RISK</Badge>;
  if (level === "medium") return <Badge className="bg-yellow-900/50 text-yellow-400 border-yellow-700 border text-xs">MEDIUM RISK</Badge>;
  return <Badge className="bg-gray-800 text-gray-400 border-gray-700 border text-xs">LOW RISK</Badge>;
}

export default function DemoPage() {
  const ghosts = DEMO_AGENTS.filter((a) => a.status === "ghost").length;
  const highRisk = DEMO_AGENTS.filter((a) => a.risk_level === "high").length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xl font-bold">
            <span>👻</span> GhostAgent
            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border text-xs ml-2">DEMO</Badge>
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
            { label: "Agents Found", value: DEMO_AGENTS.length, color: "text-white" },
            { label: "Ghost Agents", value: ghosts, color: "text-red-400" },
            { label: "High Risk", value: highRisk, color: "text-red-400" },
            { label: "Repos Scanned", value: 18, color: "text-gray-400" },
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
          ⚠️ <strong>2 ghost agents detected</strong> — these are actively running with no living owner. 
          One is connected to your Stripe API.
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
                <p className="text-gray-300 text-sm">{agent.description}</p>

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
                    <span className="text-yellow-400">⚠️ No identifiable owner</span>
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
