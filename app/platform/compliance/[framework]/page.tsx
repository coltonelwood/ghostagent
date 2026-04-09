"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, HelpCircle, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const FRAMEWORK_META: Record<string, { name: string; description: string; icon: string }> = {
  eu_ai_act: { name: "EU AI Act", description: "European Union Artificial Intelligence Act", icon: "🇪🇺" },
  soc2_ai: { name: "SOC 2 AI Controls", description: "SOC 2 controls for AI systems", icon: "🛡️" },
  iso42001: { name: "ISO/IEC 42001:2023", description: "AI Management System Standard", icon: "📋" },
  nist_ai_rmf: { name: "NIST AI RMF", description: "NIST AI Risk Management Framework", icon: "🏛️" },
};

const FRAMEWORK_CONTROLS: Record<
  string,
  Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    required: boolean;
    remediation?: string;
  }>
> = {
  eu_ai_act: [
    { id: "EUAI-ART-9", name: "Risk Management System", description: "Maintain risk management documentation for all high-risk AI systems", category: "risk", required: true, remediation: "Implement a risk management framework that covers identification, analysis, evaluation, and treatment of AI system risks. Document risk assessments for each high-risk AI asset." },
    { id: "EUAI-ART-10", name: "Data Governance", description: "AI training data must meet quality criteria", category: "data", required: true, remediation: "Establish data governance policies covering training data quality, representativeness, and bias testing. Document data lineage for all AI models." },
    { id: "EUAI-ART-11", name: "Technical Documentation", description: "Maintain technical documentation for each AI system", category: "documentation", required: true, remediation: "Create and maintain technical documentation for each AI system including purpose, design specifications, training methodology, and validation results." },
    { id: "EUAI-ART-12", name: "Record Keeping", description: "Automatic logging of events for high-risk AI", category: "logging", required: true, remediation: "Enable comprehensive logging for all high-risk AI systems. Logs should capture input/output data, model version, and decision rationale." },
    { id: "EUAI-ART-13", name: "Transparency", description: "AI systems must be interpretable and explainable", category: "transparency", required: true, remediation: "Implement explainability mechanisms for each AI system. Provide clear documentation of how AI decisions are made to affected users." },
    { id: "EUAI-ART-14", name: "Human Oversight", description: "Human oversight mechanisms must be in place", category: "oversight", required: true, remediation: "Assign human oversight roles for each high-risk AI system. Implement human-in-the-loop or human-on-the-loop mechanisms where required." },
    { id: "EUAI-ART-17", name: "Quality Management", description: "Quality management system for high-risk AI", category: "governance", required: true, remediation: "Establish a QMS covering AI system lifecycle: design, development, testing, deployment, monitoring, and retirement." },
  ],
  soc2_ai: [
    { id: "CC6.6", name: "Logical Access Controls", description: "AI systems implement logical access restrictions", category: "access", required: true, remediation: "Implement role-based access control for all AI systems. Ensure API keys and model endpoints are properly secured." },
    { id: "CC7.1", name: "System Operations", description: "AI systems are monitored for anomalies", category: "monitoring", required: true, remediation: "Deploy monitoring for AI system performance, drift, and anomalous behavior. Set up alerts for model degradation." },
    { id: "CC7.2", name: "Security Incidents", description: "AI-related security incidents are tracked", category: "incidents", required: true, remediation: "Extend incident response procedures to cover AI-specific incidents such as model poisoning, prompt injection, and data exfiltration." },
    { id: "CC8.1", name: "Change Management", description: "AI system changes follow change management processes", category: "change", required: true, remediation: "Apply change management procedures to model updates, retraining, and configuration changes. Maintain version control for all models." },
    { id: "A1.2", name: "Availability", description: "AI system availability is monitored", category: "availability", required: false, remediation: "Monitor uptime and availability of AI systems. Implement failover and fallback mechanisms for critical AI services." },
  ],
  iso42001: [
    { id: "4.1", name: "Context of the Organization", description: "Understand AI system context and stakeholders", category: "context", required: true, remediation: "Document the organizational context for AI use, including stakeholder expectations and regulatory requirements." },
    { id: "5.2", name: "AI Policy", description: "Top management establishes AI policy", category: "governance", required: true, remediation: "Draft and publish an organizational AI policy approved by senior leadership. Communicate to all relevant parties." },
    { id: "6.1", name: "Risk Assessment", description: "AI risks are identified and assessed", category: "risk", required: true, remediation: "Conduct risk assessments for all AI systems using a standardized methodology. Document risks and mitigation plans." },
    { id: "8.4", name: "AI System Impact Assessment", description: "Impact assessment before deploying AI systems", category: "impact", required: true, remediation: "Perform impact assessments before deploying any new AI system. Evaluate ethical, legal, and social implications." },
    { id: "9.1", name: "Monitoring and Measurement", description: "AI systems are monitored against objectives", category: "monitoring", required: true, remediation: "Define measurable objectives for AI systems and implement monitoring to track performance against these objectives." },
    { id: "10.2", name: "Nonconformity and Corrective Action", description: "Nonconformities are corrected", category: "remediation", required: true, remediation: "Establish a process for identifying and correcting nonconformities in AI systems. Track corrective actions to completion." },
  ],
  nist_ai_rmf: [
    { id: "GOVERN-1", name: "Governance Policies", description: "AI risk governance policies are in place", category: "govern", required: true, remediation: "Develop and implement AI governance policies that define roles, responsibilities, and decision-making authority." },
    { id: "GOVERN-2", name: "AI Accountability", description: "Organizational roles for AI are defined", category: "govern", required: true, remediation: "Define clear accountability structures for AI systems including model owners, data stewards, and risk managers." },
    { id: "MAP-1", name: "AI Context", description: "Organizational context for AI risk is mapped", category: "map", required: true, remediation: "Map the organizational context including intended uses, stakeholders, and potential impacts of each AI system." },
    { id: "MAP-3", name: "AI Categorization", description: "AI systems are categorized by risk", category: "map", required: true, remediation: "Categorize all AI systems by risk level using a consistent taxonomy. Prioritize governance effort based on risk tier." },
    { id: "MEASURE-2", name: "Risk Measurement", description: "AI risks are measured and documented", category: "measure", required: true, remediation: "Implement quantitative and qualitative measures for AI risks. Track metrics over time and report to leadership." },
    { id: "MANAGE-1", name: "Risk Response", description: "Risks are prioritized and responded to", category: "manage", required: true, remediation: "Prioritize identified risks and implement appropriate risk responses: mitigate, accept, transfer, or avoid." },
    { id: "MANAGE-3", name: "Remediation", description: "Identified risks have remediation plans", category: "manage", required: true, remediation: "Create remediation plans for all identified risks with timelines, owners, and success criteria." },
  ],
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "compliant":
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    case "non_compliant":
      return <XCircle className="h-5 w-5 text-destructive" />;
    case "needs_review":
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    default:
      return <HelpCircle className="h-5 w-5 text-muted-foreground" />;
  }
}

const STATUS_BADGE: Record<string, "destructive" | "secondary" | "outline"> = {
  compliant: "secondary",
  non_compliant: "destructive",
  needs_review: "outline",
  not_assessed: "outline",
  not_applicable: "secondary",
};

interface ControlState {
  status: string;
  asset_count: number;
  assets: Array<{ id: string; name: string; risk_level: string }>;
}

export default function FrameworkDetailPage({ params }: { params: Promise<{ framework: string }> }) {
  const { framework } = use(params);
  const meta = FRAMEWORK_META[framework];
  const controls = FRAMEWORK_CONTROLS[framework] ?? [];
  const [controlStates, setControlStates] = useState<Record<string, ControlState>>({});
  const [expandedControl, setExpandedControl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/compliance/${framework}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.controls) {
          const states: Record<string, ControlState> = {};
          for (const c of d.data.controls) {
            states[c.control_id] = {
              status: c.status ?? "not_assessed",
              asset_count: c.asset_count ?? 0,
              assets: c.assets ?? [],
            };
          }
          setControlStates(states);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [framework]);

  function updateControlStatus(controlId: string, status: string) {
    setControlStates((prev) => ({
      ...prev,
      [controlId]: {
        ...prev[controlId],
        status,
        asset_count: prev[controlId]?.asset_count ?? 0,
        assets: prev[controlId]?.assets ?? [],
      },
    }));
    // Persist to API (fire-and-forget)
    fetch(`/api/compliance/${framework}/controls/${controlId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => {});
  }

  if (!meta) {
    return (
      <div className="p-8 text-center text-muted-foreground">Framework not found</div>
    );
  }

  const compliantCount = controls.filter(
    (c) => controlStates[c.id]?.status === "compliant"
  ).length;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <Link
          href="/platform/compliance"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Compliance
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{meta.icon}</span>
          <div>
            <h1 className="text-2xl font-bold">{meta.name}</h1>
            <p className="text-muted-foreground">{meta.description}</p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold">
                {compliantCount}/{controls.length}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Controls Compliant</p>
            </div>
            <div className="flex-1">
              <div className="h-2 bg-muted rounded-full">
                <div
                  className="h-2 bg-emerald-500 rounded-full transition-all"
                  style={{
                    width: controls.length > 0 ? `${(compliantCount / controls.length) * 100}%` : "0%",
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info note */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">How compliance works in Nexus:</strong> Connect
            your AI assets, then use the controls below as a checklist. Mark each control&apos;s
            status. Nexus automatically populates controls where data is available (e.g., logging,
            risk scoring, ownership).
          </p>
        </CardContent>
      </Card>

      {/* Controls table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Control ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Assets</TableHead>
                  <TableHead className="w-40">Set Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {controls.map((control) => {
                  const state = controlStates[control.id];
                  const status = state?.status ?? "not_assessed";
                  const assetCount = state?.asset_count ?? 0;
                  const isExpanded = expandedControl === control.id;
                  const hasAssets = (state?.assets?.length ?? 0) > 0;

                  return (
                    <>
                      <TableRow
                        key={control.id}
                        className={isExpanded ? "border-b-0" : ""}
                      >
                        <TableCell>
                          {hasAssets ? (
                            <button
                              onClick={() =>
                                setExpandedControl(isExpanded ? null : control.id)
                              }
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          ) : (
                            <StatusIcon status={status} />
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs font-semibold">
                            {control.id}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge variant="outline" className="capitalize text-xs">
                              {control.category}
                            </Badge>
                            {control.required && (
                              <Badge variant="secondary" className="text-xs">
                                Required
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{control.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {control.description}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={STATUS_BADGE[status] ?? "outline"}
                            className="capitalize text-xs"
                          >
                            {status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm">{assetCount}</span>
                        </TableCell>
                        <TableCell>
                          <select
                            className="px-2 py-1 border rounded text-xs bg-background w-full"
                            value={status}
                            onChange={(e) =>
                              updateControlStatus(control.id, e.target.value)
                            }
                          >
                            <option value="not_assessed">Not assessed</option>
                            <option value="compliant">Compliant</option>
                            <option value="non_compliant">Non-compliant</option>
                            <option value="needs_review">Needs review</option>
                            <option value="not_applicable">N/A</option>
                          </select>
                        </TableCell>
                      </TableRow>
                      {isExpanded && hasAssets && (
                        <TableRow key={`${control.id}-expanded`}>
                          <TableCell colSpan={6} className="bg-muted/50 px-8 py-3">
                            <div className="space-y-3">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Affected Assets
                              </p>
                              <div className="divide-y">
                                {state?.assets?.map((asset) => (
                                  <div
                                    key={asset.id}
                                    className="flex items-center justify-between py-1.5"
                                  >
                                    <Link
                                      href={`/platform/assets/${asset.id}`}
                                      className="text-sm text-primary hover:underline"
                                    >
                                      {asset.name}
                                    </Link>
                                    <Badge variant="outline" className="capitalize text-xs">
                                      {asset.risk_level}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                              {control.remediation && (
                                <div className="mt-2 p-3 bg-background rounded-lg border">
                                  <p className="text-xs font-semibold mb-1">
                                    Remediation Recommendation
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {control.remediation}
                                  </p>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <LinkButton href="/platform/reports">Generate Compliance Report</LinkButton>
        <LinkButton href="/platform/assets" variant="outline">
          View Asset Registry
        </LinkButton>
      </div>
    </div>
  );
}
