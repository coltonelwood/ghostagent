import Link from "next/link";
import { ArrowRight, ArrowLeft, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { RiskBadge } from "@/components/ui/risk-badge";
import { cn } from "@/lib/utils";
import {
  Database,
  AlertTriangle,
  UserX,
  ShieldAlert,
  Clock,
} from "lucide-react";

// --------------------------------------------------------------------------
// Fixture data — curated findings from a fictional healthcare SaaS
// --------------------------------------------------------------------------

interface Finding {
  id: string;
  name: string;
  path: string;
  repo: string;
  type: string;
  risk: "critical" | "high" | "medium" | "low";
  confidence: number;
  owner: string | null;
  ownerStatus: "active" | "inactive" | "orphaned";
  lastActive: number | null;
  frameworks: string[];
  services: string[];
  description: string;
  finding: string;
}

const FINDINGS: Finding[] = [
  {
    id: "1",
    name: "claims-fraud-v3",
    path: ".env.example",
    repo: "acme/claims-engine",
    type: "ML Scoring Service",
    risk: "critical",
    confidence: 94,
    owner: null,
    ownerStatus: "orphaned",
    lastActive: 247,
    frameworks: ["HIPAA", "SOC 2"],
    services: ["postgres", "openai"],
    description:
      "Production ML model scoring every claim submission for fraud. Confidence threshold 0.85.",
    finding:
      "No documented owner or model card. If this model drifts or produces biased outputs, claims are being approved or rejected with no human review and no accountability.",
  },
  {
    id: "2",
    name: "nlu-triage-bert",
    path: "ml/nlu-triage/requirements.txt",
    repo: "acme/ml-services",
    type: "Clinical NLP Model",
    risk: "critical",
    confidence: 96,
    owner: "achen@acme.com",
    ownerStatus: "inactive",
    lastActive: 203,
    frameworks: ["HIPAA", "EU AI Act"],
    services: ["postgres"],
    description:
      "Fine-tuned Bio_ClinicalBERT model classifying urgency of patient messages. Runs as a FastAPI service.",
    finding:
      "Owner @achen has not committed in 203 days and may have left the company. A patient triage model with no active owner is a governance and patient safety risk.",
  },
  {
    id: "3",
    name: "prototype-chat",
    path: "experiments/prototype-chat/chat-server.ts",
    repo: "acme/platform",
    type: "Prototype · no auth",
    risk: "critical",
    confidence: 97,
    owner: "ajiang@acme.com",
    ownerStatus: "inactive",
    lastActive: 189,
    frameworks: ["HIPAA"],
    services: [],
    description:
      "Patient-provider WebSocket chat prototype. No authentication. In-memory only. No audit logging.",
    finding:
      "If this prototype ever processed real patient data in this state, it may create significant HIPAA exposure. Original author inactive for 189 days.",
  },
  {
    id: "4",
    name: "ai-coding-suggestions",
    path: "experiments/feature-flags/flag-config.json",
    repo: "acme/platform",
    type: "Active AI feature · 20% rollout",
    risk: "high",
    confidence: 88,
    owner: "schen@acme.com",
    ownerStatus: "active",
    lastActive: 91,
    frameworks: ["HIPAA", "SOC 2"],
    services: [],
    description:
      "AI-powered ICD-10 and CPT billing code suggestions. Active at 20% rollout. Fine-tuned model.",
    finding:
      "No documented accuracy baseline. No human review step before codes are used. Inaccurate suggestions could create billing compliance risk.",
  },
  {
    id: "5",
    name: "run-anomaly-detection.ts",
    path: "cron/weekly/run-anomaly-detection.ts",
    repo: "acme/claims-engine",
    type: "ML cron agent",
    risk: "high",
    confidence: 91,
    owner: "jliu@acme.com",
    ownerStatus: "active",
    lastActive: 74,
    frameworks: ["SOC 2"],
    services: ["postgres", "slack", "sendgrid"],
    description:
      "Weekly ML-based anomaly detection on all claims. Checks upcoding, duplicate billing, unusual volumes.",
    finding:
      "Owner is documented only in a code comment. If James Liu has left, there is no accountable owner for a system that makes compliance decisions every Sunday.",
  },
];

const FRAMEWORK_CLASS: Record<string, string> = {
  HIPAA: "border-destructive/20 bg-destructive/10 text-destructive",
  "SOC 2": "border-info/20 bg-info/10 text-info",
  "EU AI Act": "border-primary/20 bg-primary/10 text-primary",
  "ISO 42001": "border-primary/20 bg-primary/10 text-primary",
};

// --------------------------------------------------------------------------

export default function DemoPage() {
  const critical = FINDINGS.filter((f) => f.risk === "critical").length;
  const unowned = FINDINGS.filter(
    (f) => !f.owner || f.ownerStatus === "orphaned",
  ).length;
  const inactive = FINDINGS.filter((f) => f.ownerStatus === "inactive").length;
  const hipaa = FINDINGS.filter((f) => f.frameworks.includes("HIPAA")).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </Link>
            <div className="mx-2 h-5 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded bg-primary">
                <span className="text-[10px] font-semibold text-primary-foreground">
                  N
                </span>
              </div>
              <span className="text-sm font-semibold">Nexus</span>
              <span className="ml-1 inline-flex h-5 items-center rounded-sm border border-border bg-muted/40 px-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                Sample scan
              </span>
            </div>
          </div>
          <Link
            href="/auth/login"
            className={buttonVariants({ size: "sm" })}
          >
            Scan your org
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <PageHeader
          title="AI asset inventory — acme-corp"
          description="18 repositories scanned. 5 AI systems discovered across code and ML services. This is a sample — sign in to run Nexus on your own organization."
          meta={
            <>
              <span className="nx-tabular">4m 12s</span>
              <span>·</span>
              <span>6 connectors</span>
              <span>·</span>
              <span>Scan completed 2 minutes ago</span>
            </>
          }
          secondaryActions={
            <button
              type="button"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <FileText className="size-3.5" />
              Export PDF
            </button>
          }
        />

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Assets found"
            value={FINDINGS.length}
            icon={Database}
            description="Across 18 repositories"
          />
          <StatCard
            label="Critical"
            value={critical}
            icon={AlertTriangle}
            tone="danger"
            description="Require immediate review"
          />
          <StatCard
            label="Orphaned or inactive"
            value={unowned + inactive}
            icon={UserX}
            tone="warning"
            description="Owner departed or dormant"
          />
          <StatCard
            label="HIPAA exposure"
            value={hipaa}
            icon={ShieldAlert}
            tone="danger"
            description="Potential PHI touchpoints"
          />
        </div>

        {/* Banner */}
        <div className="mt-6 rounded-lg border border-destructive/20 bg-destructive/5 px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="text-[13px] leading-relaxed">
              <span className="font-semibold text-destructive">
                {critical} critical findings
              </span>
              <span className="text-foreground">
                {" "}
                — {unowned} with no owner on record, {hipaa} involving data
                covered by HIPAA. Recommended for review before your next audit.
              </span>
            </div>
          </div>
        </div>

        {/* Findings list */}
        <section className="mt-8 space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Findings
          </h2>

          {FINDINGS.map((f) => (
            <article
              key={f.id}
              className="nx-surface p-5 transition-colors hover:border-border-strong"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <RiskBadge level={f.risk} size="sm" />
                    <span className="inline-flex h-5 items-center rounded-sm border border-border px-1.5 text-[11px] text-muted-foreground">
                      {f.type}
                    </span>
                  </div>
                  <h3 className="text-[15px] font-semibold tracking-tight">
                    {f.name}
                  </h3>
                  <p className="nx-mono truncate text-[11px] text-muted-foreground/80">
                    {f.repo} · {f.path}
                  </p>
                </div>

                <div className="text-right text-[11px]">
                  <p className="text-muted-foreground">Confidence</p>
                  <p className="text-base font-semibold nx-tabular">
                    {f.confidence}%
                  </p>
                </div>
              </div>

              <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
                {f.description}
              </p>

              <div className="mt-3 rounded-md border border-border bg-muted/30 px-4 py-3">
                <p className="text-[13px] leading-relaxed text-foreground">
                  <span className="font-semibold">Finding: </span>
                  {f.finding}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-[11px]">
                {f.owner ? (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span
                      className={cn(
                        "inline-block size-1.5 rounded-full",
                        f.ownerStatus === "active"
                          ? "bg-success"
                          : "bg-warning",
                      )}
                    />
                    <span className="text-foreground">{f.owner}</span>
                    {f.lastActive !== null && (
                      <>
                        <span>·</span>
                        <span
                          className={cn(
                            "nx-tabular",
                            f.lastActive > 90
                              ? "text-warning"
                              : "text-muted-foreground",
                          )}
                        >
                          {f.lastActive}d since last commit
                        </span>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-destructive">
                    <span className="inline-block size-1.5 rounded-full bg-destructive" />
                    <span>No owner on record</span>
                  </div>
                )}

                {f.frameworks.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {f.frameworks.map((fw) => (
                      <span
                        key={fw}
                        className={cn(
                          "inline-flex h-5 items-center rounded-sm border px-1.5 text-[10px] font-medium",
                          FRAMEWORK_CLASS[fw] ??
                            "border-border bg-muted text-muted-foreground",
                        )}
                      >
                        {fw}
                      </span>
                    ))}
                  </div>
                )}

                {f.services.length > 0 && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    {f.services.map((s) => (
                      <span
                        key={s}
                        className="inline-flex h-5 items-center rounded-sm bg-muted px-1.5 text-[10px] nx-mono"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </section>

        {/* Footer CTA */}
        <div className="mt-10 rounded-lg border border-border bg-card p-8 text-center">
          <Clock className="mx-auto mb-3 size-5 text-muted-foreground/70" />
          <h2 className="text-lg font-semibold tracking-tight">
            These findings are from a fictional company.
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-[13px] leading-relaxed text-muted-foreground">
            Connect your own sources and Nexus will run the same scan on your
            real code, cloud, and automations. First scan takes under five
            minutes. No agent to install.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/auth/login"
              className={buttonVariants({ size: "lg" })}
            >
              Start free scan
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Learn more about Nexus
            </Link>
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground/70">
            No credit card required. Credentials encrypted with AES-256-GCM.
          </p>
        </div>
      </div>
    </div>
  );
}
