/**
 * threat-intelligence/prediction-engine.ts -- Predictive Attack Routing
 *
 * Uses shared threat intelligence and org genome profiles to predict
 * which network members are most likely to be targeted next. Predictions
 * are scored via dimensional analysis (industry match, tech-stack overlap,
 * vulnerability alignment, size-tier match) and persisted with recommended
 * countermeasures for each at-risk organisation.
 */

import { adminClient } from "@/lib/supabase/admin";
import { emitEvent } from "@/lib/event-system";
import { logger } from "@/lib/logger";
import { generalizeIndustry, generalizeTechStack } from "./anonymizer";
import type {
  SharedThreatIntel,
  ThreatSurfaceGenome,
  FingerprintType,
  CountermeasureType,
  RiskFactor,
  RecommendedCountermeasure,
  TechStackFingerprint,
  VulnerabilityVector,
} from "./types";

// ---- Constants ----------------------------------------------------------------

const PREDICTION_EXPIRY_DAYS = 14;
const MINIMUM_PREDICTION_SCORE = 40;

const SYSTEM_ACTOR = "00000000-0000-0000-0000-000000000000";

// ---- Countermeasure Mapping ---------------------------------------------------

function getCountermeasuresForThreatType(
  threatType: FingerprintType,
  severity: string,
): RecommendedCountermeasure[] {
  const countermeasures: RecommendedCountermeasure[] = [];
  const priority = severity === "critical" ? "critical" : severity === "high" ? "high" : "medium";

  switch (threatType) {
    case "phishing":
    case "bec":
      countermeasures.push(
        {
          type: "policy_rule",
          description: "Deploy email/communication monitoring policy to detect phishing patterns",
          priority,
          auto_deployable: true,
        },
        {
          type: "alert_escalation",
          description: "Escalate alerts for suspected phishing/BEC activity to security team",
          priority,
          auto_deployable: true,
        },
      );
      break;

    case "credential_stuffing":
      countermeasures.push({
        type: "access_restriction",
        description: "Restrict access to production systems with elevated risk scores",
        priority,
        auto_deployable: true,
      });
      break;

    case "supply_chain":
      countermeasures.push({
        type: "quarantine_pattern",
        description: "Quarantine supply-chain assets from code repositories pending review",
        priority,
        auto_deployable: severity === "critical",
      });
      break;

    case "ransomware":
      countermeasures.push(
        {
          type: "monitoring_boost",
          description: "Increase monitoring frequency for production and storage assets",
          priority,
          auto_deployable: true,
        },
        {
          type: "alert_escalation",
          description: "Escalate ransomware-related alerts to incident response team",
          priority,
          auto_deployable: true,
        },
      );
      break;

    case "data_exfiltration":
      countermeasures.push({
        type: "monitoring_boost",
        description: "Boost monitoring for data egress and unusual access patterns",
        priority,
        auto_deployable: true,
      });
      break;

    default:
      countermeasures.push({
        type: "alert_escalation",
        description: `Escalate alerts related to ${threatType} threat activity`,
        priority,
        auto_deployable: true,
      });
      break;
  }

  return countermeasures;
}

// ---- Dimensional Scoring ------------------------------------------------------

/**
 * Flatten a TechStackFingerprint into a single array of strings for
 * set-based overlap comparison.
 */
function flattenTechStack(ts: TechStackFingerprint): string[] {
  return [
    ...ts.languages,
    ...ts.frameworks,
    ...ts.cloud_providers,
    ...ts.ai_providers,
    ...ts.automation_tools,
    ...ts.hr_systems,
  ].map((s) => s.toLowerCase());
}

/**
 * Compute the prediction score for a single genome against a threat intel record.
 *
 * Dimensional scoring (mirrors risk-engine.ts pattern):
 *   - industry_match      0-30
 *   - tech_stack_overlap   0-30
 *   - vulnerability_alignment 0-25
 *   - size_tier_match      0-15
 *
 * Total range: 0-100
 */
function scorePrediction(
  intel: SharedThreatIntel,
  genome: ThreatSurfaceGenome,
): { score: number; riskFactors: RiskFactor[] } {
  const riskFactors: RiskFactor[] = [];
  let total = 0;

  // 1. Industry match (0-30)
  const orgIndustry = generalizeIndustry(genome.industry_classification);
  const affectedIndustries = intel.affected_industries.map((i) => i.toLowerCase());
  const industryMatches = affectedIndustries.includes(orgIndustry.toLowerCase());
  const industryScore = industryMatches ? 30 : 0;
  total += industryScore;
  riskFactors.push({
    factor: "industry_match",
    weight: industryScore,
    explanation: industryMatches
      ? `Organization industry "${orgIndustry}" matches affected industries`
      : `Organization industry "${orgIndustry}" not in affected industries`,
  });

  // 2. Tech stack overlap (0-30)
  const orgTechFlat = flattenTechStack(genome.tech_stack_fingerprint);
  const affectedTech = intel.affected_tech_stacks.map((t) => t.toLowerCase());
  const techOverlapCount = orgTechFlat.filter((t) => affectedTech.includes(t)).length;
  const techOverlapRatio = affectedTech.length > 0 ? techOverlapCount / affectedTech.length : 0;
  const techScore = Math.round(techOverlapRatio * 30);
  total += techScore;
  riskFactors.push({
    factor: "tech_stack_overlap",
    weight: techScore,
    explanation:
      techOverlapCount > 0
        ? `${techOverlapCount} tech-stack elements overlap with threat profile`
        : "No tech-stack overlap with threat profile",
  });

  // 3. Vulnerability alignment (0-25)
  const vulnerableVectors = genome.vulnerability_vectors.filter(
    (v: VulnerabilityVector) =>
      v.susceptibility_score > 50 && isVectorAligned(v, intel.fingerprint_type),
  );
  const vulnScore =
    vulnerableVectors.length > 0
      ? Math.min(25, Math.round((vulnerableVectors.length / genome.vulnerability_vectors.length) * 25 + 10))
      : 0;
  total += vulnScore;
  riskFactors.push({
    factor: "vulnerability_alignment",
    weight: vulnScore,
    explanation:
      vulnerableVectors.length > 0
        ? `${vulnerableVectors.length} high-susceptibility vectors align with ${intel.fingerprint_type} threat`
        : "No high-susceptibility vectors align with this threat type",
  });

  // 4. Size tier match (0-15)
  const sizeMatches = intel.affected_size_tiers.includes(genome.org_size_tier);
  const sizeScore = sizeMatches ? 15 : 0;
  total += sizeScore;
  riskFactors.push({
    factor: "size_tier_match",
    weight: sizeScore,
    explanation: sizeMatches
      ? `Organization size tier "${genome.org_size_tier}" is targeted by this threat`
      : `Organization size tier "${genome.org_size_tier}" not specifically targeted`,
  });

  return { score: Math.min(100, total), riskFactors };
}

/**
 * Check whether a vulnerability vector is aligned with the given threat
 * fingerprint type. Maps fingerprint types to relevant vector IDs.
 */
function isVectorAligned(vector: VulnerabilityVector, fingerprintType: FingerprintType): boolean {
  const alignmentMap: Record<string, string[]> = {
    phishing: ["phishing_susceptibility", "credential_compromise"],
    bec: ["phishing_susceptibility", "credential_compromise"],
    credential_stuffing: ["credential_compromise", "api_exploitation"],
    supply_chain: ["supply_chain_risk"],
    ransomware: ["ransomware_exposure", "cloud_misconfiguration"],
    data_exfiltration: ["data_exfiltration", "insider_threat"],
    insider_threat: ["insider_threat", "data_exfiltration"],
    api_abuse: ["api_exploitation", "cloud_misconfiguration"],
    social_engineering: ["phishing_susceptibility"],
  };

  const relevantVectors = alignmentMap[fingerprintType] ?? [];
  return relevantVectors.includes(vector.vector_id);
}

// ---- Public API ---------------------------------------------------------------

/**
 * Generate attack predictions for all at-risk network members based on
 * a shared threat intelligence record.
 *
 * 1. Load the shared threat intel
 * 2. Load all active network member genomes
 * 3. Score each member against the threat
 * 4. Persist predictions with score > 40
 * 5. Emit events and log results
 */
export async function generatePredictions(
  intelId: string,
): Promise<{ predictions: Array<{ id: string; orgId: string; score: number }>; total: number }> {
  // 1. Load the shared threat intelligence record
  const { data: intel, error: intelError } = await adminClient
    .from("shared_threat_intelligence")
    .select("*")
    .eq("id", intelId)
    .single();

  if (intelError || !intel) {
    logger.error({ intelId, error: intelError }, "prediction-engine: threat intel not found");
    throw new Error("Threat intelligence record not found: " + intelId);
  }

  const typedIntel = intel as unknown as SharedThreatIntel;

  // 2. Load all active network member genomes
  // Join threat_surface_genomes with network_memberships where status='active'
  const { data: memberships } = await adminClient
    .from("network_memberships")
    .select("org_id")
    .eq("status", "active");

  if (!memberships?.length) {
    logger.info({ intelId }, "prediction-engine: no active network members");
    return { predictions: [], total: 0 };
  }

  const activeOrgIds = memberships.map((m) => m.org_id as string);

  // Fetch latest genomes for each active member
  const { data: genomes } = await adminClient
    .from("threat_surface_genomes")
    .select("*")
    .in("org_id", activeOrgIds)
    .order("genome_version", { ascending: false });

  if (!genomes?.length) {
    logger.info({ intelId }, "prediction-engine: no genomes found for active members");
    return { predictions: [], total: 0 };
  }

  // Deduplicate to latest genome per org
  const latestGenomes = new Map<string, ThreatSurfaceGenome>();
  for (const g of genomes) {
    const genome = g as unknown as ThreatSurfaceGenome;
    if (!latestGenomes.has(genome.org_id)) {
      latestGenomes.set(genome.org_id, genome);
    }
  }

  // 3. Score each member
  const results: Array<{ id: string; orgId: string; score: number }> = [];
  const expiresAt = new Date(Date.now() + PREDICTION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  for (const [orgId, genome] of Array.from(latestGenomes.entries())) {
    const { score, riskFactors } = scorePrediction(typedIntel, genome);

    // 5. Only persist predictions with score > 40
    if (score <= MINIMUM_PREDICTION_SCORE) continue;

    const countermeasures = getCountermeasuresForThreatType(
      typedIntel.fingerprint_type,
      typedIntel.severity,
    );

    const { data: prediction, error: insertError } = await adminClient
      .from("attack_predictions")
      .insert({
        target_org_id: orgId,
        threat_intel_id: intelId,
        prediction_score: score,
        risk_factors: riskFactors,
        recommended_countermeasures: countermeasures,
        status: "pending",
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (insertError) {
      logger.error(
        { error: insertError, orgId, intelId },
        "prediction-engine: failed to save prediction",
      );
      continue;
    }

    const predictionId = prediction.id as string;
    results.push({ id: predictionId, orgId, score });

    // 7. Emit event
    await emitEvent({
      orgId,
      kind: "task_created" as any, // Will be 'prediction_generated' after EventKind extension
      severity: typedIntel.severity as any,
      title: "Attack prediction generated",
      body: `Prediction score ${score}/100 for ${typedIntel.fingerprint_type} threat. ${countermeasures.length} countermeasures recommended.`,
      metadata: {
        prediction_id: predictionId,
        threat_intel_id: intelId,
        prediction_score: score,
        fingerprint_type: typedIntel.fingerprint_type,
      },
    });
  }

  // 8. Log results
  logger.info(
    {
      intelId,
      totalMembers: latestGenomes.size,
      predictionsGenerated: results.length,
      fingerprint_type: typedIntel.fingerprint_type,
    },
    "prediction-engine: predictions generated",
  );

  return { predictions: results, total: results.length };
}

/**
 * List predictions for an organisation with optional filtering.
 */
export async function getPredictions(
  orgId: string,
  options?: { limit?: number; offset?: number; status?: string; minScore?: number },
): Promise<{ data: unknown[]; total: number }> {
  let q = adminClient
    .from("attack_predictions")
    .select("*, threat_intel:shared_threat_intelligence(*)", { count: "exact" })
    .eq("target_org_id", orgId)
    .order("prediction_score", { ascending: false });

  if (options?.status) q = q.eq("status", options.status);
  if (options?.minScore) q = q.gte("prediction_score", options.minScore);

  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;
  q = q.range(offset, offset + limit - 1);

  const { data, count } = await q;
  return { data: data ?? [], total: count ?? 0 };
}

/**
 * Retrieve a single prediction by ID, scoped to the target org.
 */
export async function getPrediction(predictionId: string, orgId: string) {
  const { data } = await adminClient
    .from("attack_predictions")
    .select("*, threat_intel:shared_threat_intelligence(*)")
    .eq("id", predictionId)
    .eq("target_org_id", orgId)
    .single();
  return data;
}

/**
 * Mark a prediction as acknowledged by the target organisation.
 */
export async function acknowledgePrediction(
  predictionId: string,
  orgId: string,
): Promise<{ success: boolean }> {
  const { data: prediction, error: fetchError } = await adminClient
    .from("attack_predictions")
    .select("id, status")
    .eq("id", predictionId)
    .eq("target_org_id", orgId)
    .single();

  if (fetchError || !prediction) {
    logger.error({ predictionId, orgId }, "prediction-engine: prediction not found");
    return { success: false };
  }

  if (prediction.status !== "pending") {
    logger.info(
      { predictionId, currentStatus: prediction.status },
      "prediction-engine: prediction already processed",
    );
    return { success: false };
  }

  const { error: updateError } = await adminClient
    .from("attack_predictions")
    .update({
      status: "acknowledged",
      notified_at: new Date().toISOString(),
    })
    .eq("id", predictionId);

  if (updateError) {
    logger.error({ error: updateError, predictionId }, "prediction-engine: failed to acknowledge");
    return { success: false };
  }

  await emitEvent({
    orgId,
    kind: "task_created" as any, // Will be 'prediction_acknowledged' after EventKind extension
    severity: "info",
    title: "Attack prediction acknowledged",
    body: `Prediction ${predictionId} has been acknowledged by the organisation.`,
    metadata: { prediction_id: predictionId },
  });

  logger.info({ predictionId, orgId }, "prediction acknowledged");
  return { success: true };
}
