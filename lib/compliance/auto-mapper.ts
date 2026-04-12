// ---------------------------------------------------------------------------
// Auto-compliance mapper
//
// Automatically creates compliance_mappings based on asset attributes.
// Runs after every sync so the compliance page is pre-populated
// without manual user input.
// ---------------------------------------------------------------------------

import { getAdminClient } from "@/lib/supabase/admin";
import { BUILTIN_FRAMEWORKS } from "./frameworks";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "compliance-auto-mapper" });

interface AssetRow {
  id: string;
  name: string;
  kind: string;
  risk_level: string | null;
  risk_score: number | null;
  owner_email: string | null;
  owner_status: string;
  environment: string;
  review_status: string;
  description: string | null;
  ai_services: Array<{ provider: string }> | null;
  data_classification: string[] | null;
  status: string;
  org_id: string;
}

interface FrameworkRow {
  id: string;
  code: string;
}

type ControlStatus = "compliant" | "non_compliant" | "needs_review";

/**
 * Determine the status of a control for a given asset based on what
 * the scanner already knows. Deterministic — no LLM calls.
 */
function evaluateControl(
  controlId: string,
  category: string,
  asset: AssetRow,
): ControlStatus {
  const hasOwner = asset.owner_status === "active" || asset.owner_status === "active_owner";
  const hasDescription = !!asset.description && asset.description.length > 10;
  const hasRiskScore = asset.risk_score !== null && asset.risk_score > 0;
  const isReviewed = asset.review_status === "reviewed";
  const hasAiServices = Array.isArray(asset.ai_services) && asset.ai_services.length > 0;

  // Category-based rules
  switch (category) {
    case "risk":
    case "risk_management":
      // Compliant if risk has been scored
      return hasRiskScore ? "compliant" : "non_compliant";

    case "governance":
    case "govern":
      // Compliant if asset has an owner and has been reviewed
      if (hasOwner && isReviewed) return "compliant";
      if (hasOwner || isReviewed) return "needs_review";
      return "non_compliant";

    case "documentation":
    case "context":
      // Compliant if asset has a description
      return hasDescription ? "compliant" : "needs_review";

    case "logging":
    case "audit":
      // We always log events — compliant by default
      return "compliant";

    case "transparency":
      // Compliant if AI services are documented
      return hasAiServices ? "compliant" : "needs_review";

    case "oversight":
      // Compliant if asset has an active owner
      return hasOwner ? "compliant" : "non_compliant";

    case "data":
    case "data_governance":
      // Needs review if sensitive data, compliant otherwise
      const dc = asset.data_classification ?? [];
      if (dc.some((c) => ["pii", "phi", "financial"].includes(c))) {
        return isReviewed ? "needs_review" : "non_compliant";
      }
      return "compliant";

    case "access":
      // Compliant if owner exists (implies access is managed)
      return hasOwner ? "compliant" : "needs_review";

    case "monitoring":
      // We monitor via scan — compliant if recently scored
      return hasRiskScore ? "compliant" : "needs_review";

    case "incidents":
    case "remediation":
      // Needs review — can't auto-determine incident handling
      return isReviewed ? "needs_review" : "non_compliant";

    case "change":
      // Compliant if asset has been reviewed (implies change management)
      return isReviewed ? "compliant" : "needs_review";

    case "availability":
      // Can't auto-determine — needs review
      return "needs_review";

    case "impact":
      // Compliant if risk-scored and described
      return hasRiskScore && hasDescription ? "compliant" : "needs_review";

    case "map":
      // Compliant if asset is documented with services
      return hasDescription || hasAiServices ? "compliant" : "needs_review";

    case "measure":
      // Compliant if risk scoring exists
      return hasRiskScore ? "compliant" : "needs_review";

    case "manage":
      // Compliant if owned and reviewed
      if (hasOwner && isReviewed) return "compliant";
      if (hasOwner) return "needs_review";
      return "non_compliant";

    default:
      return "needs_review";
  }
}

/**
 * Auto-map all active assets to all enabled compliance framework controls.
 * Creates or updates compliance_mappings rows.
 */
export async function autoMapCompliance(orgId: string): Promise<{ mapped: number }> {
  const db = getAdminClient();

  // Fetch assets and frameworks in parallel
  const [assetsRes, frameworksRes] = await Promise.all([
    db.from("assets")
      .select("id, name, kind, risk_level, risk_score, owner_email, owner_status, environment, review_status, description, ai_services, data_classification, status, org_id")
      .eq("org_id", orgId)
      .eq("status", "active"),
    db.from("compliance_frameworks")
      .select("id, code")
      .eq("enabled", true),
  ]);

  const assets = (assetsRes.data ?? []) as AssetRow[];
  const frameworks = (frameworksRes.data ?? []) as FrameworkRow[];

  if (assets.length === 0 || frameworks.length === 0) {
    log.info({ orgId, assets: assets.length, frameworks: frameworks.length }, "Nothing to map");
    return { mapped: 0 };
  }

  const frameworkCodeToId = new Map(frameworks.map((f) => [f.code, f.id]));
  const mappings: Array<{
    framework_id: string;
    control_id: string;
    asset_id: string;
    org_id: string;
    status: ControlStatus;
    evidence: string[];
  }> = [];

  for (const fw of BUILTIN_FRAMEWORKS) {
    const dbId = frameworkCodeToId.get(fw.code);
    if (!dbId) continue;

    for (const control of fw.controls) {
      for (const asset of assets) {
        const status = evaluateControl(control.id, control.category, asset);
        mappings.push({
          framework_id: dbId,
          control_id: control.id,
          asset_id: asset.id,
          org_id: orgId,
          status,
          evidence: [`Auto-assessed based on asset attributes (${new Date().toISOString().slice(0, 10)})`],
        });
      }
    }
  }

  if (mappings.length === 0) return { mapped: 0 };

  // Upsert in batches of 100
  let mapped = 0;
  for (let i = 0; i < mappings.length; i += 100) {
    const batch = mappings.slice(i, i + 100);
    const { error } = await db
      .from("compliance_mappings")
      .upsert(batch, { onConflict: "org_id,asset_id,framework_id,control_id" });

    if (error) {
      log.error({ orgId, error, batch: i }, "Failed to upsert compliance mappings");
    } else {
      mapped += batch.length;
    }
  }

  log.info({ orgId, mapped, assets: assets.length, frameworks: frameworks.length }, "Auto-mapped compliance");
  return { mapped };
}
