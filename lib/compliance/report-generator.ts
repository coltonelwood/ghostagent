// ---------------------------------------------------------------------------
// Compliance report generator
// Queries the DB and produces structured compliance reports.
// ---------------------------------------------------------------------------

import { getAdminClient } from "@/lib/supabase/admin";
import logger from "@/lib/logger";
import {
  BUILTIN_FRAMEWORKS,
  getFrameworkByCode,
  type FrameworkDefinition,
} from "./frameworks";
import type { ComplianceControl } from "@/lib/types/platform";

const log = logger.child({ module: "compliance" });

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ComplianceReportData {
  orgId: string;
  generatedAt: string;
  frameworks: FrameworkReport[];
  overallScore: number;
  totalControls: number;
  compliantControls: number;
  nonCompliantControls: number;
  needsReviewControls: number;
}

export interface FrameworkReport {
  code: string;
  name: string;
  version: string;
  score: number;
  controls: ControlStatus[];
  gaps: ComplianceGapDetail[];
}

export interface ControlStatus {
  controlId: string;
  controlName: string;
  category: string;
  required: boolean;
  status:
    | "compliant"
    | "non_compliant"
    | "not_applicable"
    | "needs_review"
    | "unknown";
  assetCount: number;
  compliantAssetCount: number;
}

export interface ComplianceGapDetail {
  controlId: string;
  controlName: string;
  category: string;
  affectedAssets: Array<{ id: string; name: string; status: string }>;
  recommendation: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Map a category string to an actionable recommendation.
 */
function recommendationForCategory(category: string): string {
  const map: Record<string, string> = {
    governance:
      "Assign an owner to ensure accountability and establish a governance review cadence.",
    risk_management:
      "Conduct a formal risk assessment and document risk treatment decisions.",
    transparency:
      "Publish clear documentation about AI capabilities, limitations, and data usage.",
    data_governance:
      "Implement data quality checks, lineage tracking, and retention policies for training data.",
    documentation:
      "Create and maintain comprehensive technical documentation for this AI system.",
    technical:
      "Implement automated testing for accuracy, robustness, and security of the AI system.",
    audit:
      "Enable automated logging and establish a regular audit review schedule.",
    security:
      "Apply defense-in-depth security controls including access management, encryption, and adversarial testing.",
    availability:
      "Set up continuous monitoring with defined SLOs and automated alerting for model drift.",
    processing_integrity:
      "Validate data pipeline completeness and accuracy with automated integrity checks.",
    confidentiality:
      "Encrypt sensitive training data at rest and in transit with strict access controls.",
    privacy:
      "Review data minimization practices, consent mechanisms, and implement right-to-erasure workflows.",
    operations:
      "Ensure adequate staffing, training, and competence for personnel managing AI systems.",
    monitoring:
      "Establish KPIs for AI system performance and schedule regular management reviews.",
    improvement:
      "Implement a continual improvement process with lessons-learned reviews after each release cycle.",
    govern:
      "Formalize AI governance policies and assign clear roles and responsibilities.",
    map: "Document AI system context, intended use-cases, and potential downstream impacts.",
    measure:
      "Apply quantitative and qualitative risk measurement methods and track metrics over time.",
    manage:
      "Define and execute risk response strategies with clear escalation paths for incidents.",
  };

  return (
    map[category] ??
    "Review this control area and implement appropriate measures to achieve compliance."
  );
}

/**
 * Derive the status for a single control based on its mapped assets.
 */
function deriveControlStatus(
  control: ComplianceControl,
  mappings: MappingRow[],
): ControlStatus {
  const relevant = mappings.filter((m) => m.control_id === control.id);
  const total = relevant.length;
  const compliant = relevant.filter((m) => m.status === "compliant").length;

  let status: ControlStatus["status"];
  if (total === 0) {
    status = "unknown";
  } else if (compliant === total) {
    status = "compliant";
  } else if (relevant.some((m) => m.status === "needs_review")) {
    status = "needs_review";
  } else if (relevant.some((m) => m.status === "not_applicable") && compliant + relevant.filter((m) => m.status === "not_applicable").length === total) {
    status = "compliant";
  } else {
    status = "non_compliant";
  }

  return {
    controlId: control.id,
    controlName: control.name,
    category: control.category,
    required: control.required,
    status,
    assetCount: total,
    compliantAssetCount: compliant,
  };
}

/**
 * Build gap details for non-compliant or unknown controls.
 */
function buildGaps(
  controls: ControlStatus[],
  controlDefs: ComplianceControl[],
  mappings: MappingRow[],
  assets: AssetRow[],
): ComplianceGapDetail[] {
  const gaps: ComplianceGapDetail[] = [];

  for (const cs of controls) {
    if (cs.status === "compliant" || cs.status === "not_applicable") continue;

    const def = controlDefs.find((c) => c.id === cs.controlId);
    if (!def) continue;

    const relevant = mappings.filter(
      (m) => m.control_id === cs.controlId && m.status !== "compliant" && m.status !== "not_applicable",
    );

    const affectedAssets = relevant.map((m) => {
      const asset = assets.find((a) => a.id === m.asset_id);
      return {
        id: m.asset_id,
        name: asset?.name ?? m.asset_id,
        status: m.status,
      };
    });

    gaps.push({
      controlId: cs.controlId,
      controlName: cs.controlName,
      category: cs.category,
      affectedAssets,
      recommendation: recommendationForCategory(cs.category),
    });
  }

  return gaps;
}

/**
 * Calculate a compliance score (0-100) from control statuses.
 */
function calcScore(controls: ControlStatus[]): number {
  if (controls.length === 0) return 0;
  const compliant = controls.filter(
    (c) => c.status === "compliant" || c.status === "not_applicable",
  ).length;
  return Math.round((compliant / controls.length) * 100);
}

// ---------------------------------------------------------------------------
// Internal DB row types
// ---------------------------------------------------------------------------

interface MappingRow {
  id: string;
  framework_id: string;
  control_id: string;
  asset_id: string;
  status: string;
  org_id: string;
}

interface AssetRow {
  id: string;
  name: string;
  risk_level?: string;
  org_id: string;
}

interface FrameworkRow {
  id: string;
  code: string;
  name: string;
  version: string;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchEnabledFrameworks(orgId: string): Promise<FrameworkRow[]> {
  const db = getAdminClient();
  const { data, error } = await db
    .from("compliance_frameworks")
    .select("id, code, name, version, enabled")
    .eq("enabled", true);

  if (error) {
    log.error({ orgId, error }, "Failed to fetch compliance frameworks");
    throw new Error(`Failed to fetch compliance frameworks: ${error.message}`);
  }

  return (data as FrameworkRow[]) ?? [];
}

async function fetchMappingsForOrg(orgId: string): Promise<MappingRow[]> {
  const db = getAdminClient();
  const { data, error } = await db
    .from("compliance_mappings")
    .select("id, framework_id, control_id, asset_id, status, org_id")
    .eq("org_id", orgId);

  if (error) {
    log.error({ orgId, error }, "Failed to fetch compliance mappings");
    throw new Error(`Failed to fetch compliance mappings: ${error.message}`);
  }

  return (data as MappingRow[]) ?? [];
}

async function fetchAssetsForOrg(orgId: string): Promise<AssetRow[]> {
  const db = getAdminClient();
  const { data, error } = await db
    .from("assets")
    .select("id, name, risk_level, org_id")
    .eq("org_id", orgId);

  if (error) {
    log.error({ orgId, error }, "Failed to fetch assets");
    throw new Error(`Failed to fetch assets: ${error.message}`);
  }

  return (data as AssetRow[]) ?? [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a compliance report for a single framework.
 */
export async function complianceReport(
  orgId: string,
  frameworkCode: string,
): Promise<FrameworkReport> {
  log.info({ orgId, frameworkCode }, "Generating compliance report");

  const definition = getFrameworkByCode(frameworkCode);
  if (!definition) {
    throw new Error(`Unknown framework code: ${frameworkCode}`);
  }

  const [enabledFrameworks, mappings, assets] = await Promise.all([
    fetchEnabledFrameworks(orgId),
    fetchMappingsForOrg(orgId),
    fetchAssetsForOrg(orgId),
  ]);

  const dbFramework = enabledFrameworks.find((f) => f.code === frameworkCode);
  if (!dbFramework) {
    log.warn({ orgId, frameworkCode }, "Framework not enabled or not found in DB");
  }

  // Filter mappings to this framework (match by framework DB id if available)
  const frameworkMappings = dbFramework
    ? mappings.filter((m) => m.framework_id === dbFramework.id)
    : [];

  const controlStatuses = definition.controls.map((ctrl) =>
    deriveControlStatus(ctrl, frameworkMappings),
  );

  const gaps = buildGaps(
    controlStatuses,
    definition.controls,
    frameworkMappings,
    assets,
  );

  const report: FrameworkReport = {
    code: definition.code,
    name: definition.name,
    version: definition.version,
    score: calcScore(controlStatuses),
    controls: controlStatuses,
    gaps,
  };

  log.info(
    { orgId, frameworkCode, score: report.score, gapCount: gaps.length },
    "Compliance report generated",
  );

  return report;
}

/**
 * Generate a full compliance report across all enabled built-in frameworks.
 */
export async function fullComplianceReport(
  orgId: string,
): Promise<ComplianceReportData> {
  log.info({ orgId }, "Generating full compliance report");

  const enabledFrameworks = await fetchEnabledFrameworks(orgId);
  const enabledCodes = new Set(enabledFrameworks.map((f) => f.code));

  const frameworksToReport = BUILTIN_FRAMEWORKS.filter((f) =>
    enabledCodes.has(f.code),
  );

  const reports = await Promise.all(
    frameworksToReport.map((f) => complianceReport(orgId, f.code)),
  );

  let totalControls = 0;
  let compliantControls = 0;
  let nonCompliantControls = 0;
  let needsReviewControls = 0;

  for (const r of reports) {
    for (const c of r.controls) {
      totalControls++;
      if (c.status === "compliant" || c.status === "not_applicable") {
        compliantControls++;
      } else if (c.status === "non_compliant") {
        nonCompliantControls++;
      } else if (c.status === "needs_review") {
        needsReviewControls++;
      }
    }
  }

  const overallScore =
    totalControls > 0
      ? Math.round((compliantControls / totalControls) * 100)
      : 0;

  const result: ComplianceReportData = {
    orgId,
    generatedAt: new Date().toISOString(),
    frameworks: reports,
    overallScore,
    totalControls,
    compliantControls,
    nonCompliantControls,
    needsReviewControls,
  };

  log.info(
    { orgId, overallScore, totalControls, frameworkCount: reports.length },
    "Full compliance report generated",
  );

  return result;
}

/**
 * Generate an executive summary with high-level scores, critical gaps, and risk distribution.
 */
export async function executiveSummary(orgId: string): Promise<{
  overallScore: number;
  frameworks: Array<{
    code: string;
    name: string;
    score: number;
    gapCount: number;
  }>;
  criticalGaps: ComplianceGapDetail[];
  totalAssets: number;
  assessedAssets: number;
  riskDistribution: Record<string, number>;
}> {
  log.info({ orgId }, "Generating executive summary");

  const [fullReport, assets] = await Promise.all([
    fullComplianceReport(orgId),
    fetchAssetsForOrg(orgId),
  ]);

  // Collect all asset IDs that appear in any mapping
  const mappings = await fetchMappingsForOrg(orgId);
  const assessedAssetIds = new Set(mappings.map((m) => m.asset_id));

  // Build risk distribution from assets
  const riskDistribution: Record<string, number> = {};
  for (const asset of assets) {
    const level = asset.risk_level ?? "unassessed";
    riskDistribution[level] = (riskDistribution[level] ?? 0) + 1;
  }

  // Critical gaps: gaps from required controls that are non-compliant
  const criticalGaps: ComplianceGapDetail[] = [];
  for (const fw of fullReport.frameworks) {
    for (const gap of fw.gaps) {
      const controlStatus = fw.controls.find(
        (c) => c.controlId === gap.controlId,
      );
      if (controlStatus?.required && controlStatus.status === "non_compliant") {
        criticalGaps.push(gap);
      }
    }
  }

  const summary = {
    overallScore: fullReport.overallScore,
    frameworks: fullReport.frameworks.map((fw) => ({
      code: fw.code,
      name: fw.name,
      score: fw.score,
      gapCount: fw.gaps.length,
    })),
    criticalGaps,
    totalAssets: assets.length,
    assessedAssets: assessedAssetIds.size,
    riskDistribution,
  };

  log.info(
    {
      orgId,
      overallScore: summary.overallScore,
      criticalGapCount: criticalGaps.length,
    },
    "Executive summary generated",
  );

  return summary;
}

/**
 * Generate a gap-only report for a specific framework.
 */
export async function gapReport(
  orgId: string,
  frameworkCode: string,
): Promise<ComplianceGapDetail[]> {
  log.info({ orgId, frameworkCode }, "Generating gap report");

  const report = await complianceReport(orgId, frameworkCode);

  log.info(
    { orgId, frameworkCode, gapCount: report.gaps.length },
    "Gap report generated",
  );

  return report.gaps;
}
