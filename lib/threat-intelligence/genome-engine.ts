/**
 * threat-intelligence/genome-engine.ts — Threat Surface Genome computation
 *
 * Computes a Threat Surface Genome for an organization by aggregating its
 * existing assets. The genome captures tech-stack fingerprints, exposure
 * profiles, and vulnerability vectors mapped to MITRE ATT&CK tactics.
 *
 * The genome is versioned and change-detected via SHA-256 hashing so
 * redundant recomputation is skipped when nothing has changed.
 */

import { adminClient } from "@/lib/supabase/admin";
import { emitEvent } from "@/lib/event-system";
import { logger } from "@/lib/logger";
import { createHash } from "crypto";
import type { Asset, AIService } from "@/lib/types/platform";

// ─── MITRE ATT&CK MAPPING CONSTANTS ────────────────────────────────────────

const ATTACK_VECTORS = [
  { id: "phishing_susceptibility", name: "Phishing Susceptibility", tech_signals: ["email", "slack", "communication"], weight: 1.0 },
  { id: "supply_chain_risk", name: "Supply Chain Risk", tech_signals: ["github", "gitlab", "bitbucket", "npm", "pypi"], weight: 0.9 },
  { id: "cloud_misconfiguration", name: "Cloud Misconfiguration", tech_signals: ["aws", "gcp", "azure", "cloud"], weight: 0.85 },
  { id: "api_exploitation", name: "API Exploitation", tech_signals: ["api", "rest", "graphql", "webhook"], weight: 0.8 },
  { id: "credential_compromise", name: "Credential Compromise", tech_signals: ["auth", "oauth", "sso", "ldap"], weight: 0.9 },
  { id: "ai_model_poisoning", name: "AI Model Poisoning", tech_signals: ["openai", "anthropic", "bedrock", "vertex", "sagemaker", "huggingface"], weight: 0.7 },
  { id: "data_exfiltration", name: "Data Exfiltration", tech_signals: ["pii", "phi", "financial", "database", "s3"], weight: 0.95 },
  { id: "automation_abuse", name: "Automation Abuse", tech_signals: ["zapier", "n8n", "make", "automation", "workflow"], weight: 0.6 },
  { id: "insider_threat", name: "Insider Threat", tech_signals: ["admin", "write", "delete", "privileged"], weight: 0.75 },
  { id: "ransomware_exposure", name: "Ransomware Exposure", tech_signals: ["production", "storage", "backup", "database"], weight: 0.85 },
] as const;

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface GenomeResult {
  id: string;
  genome_version: number;
  genome_hash: string;
  vulnerability_vectors: Array<{
    vector_id: string;
    name: string;
    susceptibility_score: number;
    factors: string[];
  }>;
}

// ─── SOURCE CATEGORISATION ──────────────────────────────────────────────────

const SOURCE_CATEGORIES: Record<string, Set<string>> = {
  code: new Set(["github", "gitlab", "bitbucket"]),
  cloud: new Set(["aws", "gcp", "azure"]),
  automation: new Set(["zapier", "n8n", "make"]),
  hr: new Set(["rippling", "bamboohr", "workday"]),
};

const KNOWN_LANGUAGES = new Set(["python", "javascript", "typescript", "go", "rust", "java"]);
const KNOWN_FRAMEWORKS = new Set(["react", "next", "django", "flask", "spring"]);

// ─── PUBLIC API ─────────────────────────────────────────────────────────────

/**
 * Compute (or re-compute) the Threat Surface Genome for `orgId`.
 *
 * If the resulting genome hash matches the latest stored version the
 * database write is skipped and the existing genome is returned.
 */
export async function computeGenome(orgId: string): Promise<GenomeResult> {
  // 1. Fetch all active assets for this org
  const { data: assets } = await adminClient
    .from("assets")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "active");

  const typedAssets = (assets ?? []) as unknown as Asset[];

  // 2. Build tech_stack_fingerprint by aggregating ai_services and sources
  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const cloud_providers = new Set<string>();
  const ai_providers = new Set<string>();
  const automation_tools = new Set<string>();
  const hr_systems = new Set<string>();

  for (const asset of typedAssets) {
    // Collect AI providers
    for (const svc of asset.ai_services ?? []) {
      ai_providers.add(svc.provider.toLowerCase());
    }

    // Categorise by source
    const src = (asset.source ?? "").toLowerCase();
    if (SOURCE_CATEGORIES.code.has(src)) frameworks.add(src);
    if (SOURCE_CATEGORIES.cloud.has(src)) cloud_providers.add(src);
    if (SOURCE_CATEGORIES.automation.has(src)) automation_tools.add(src);
    if (SOURCE_CATEGORIES.hr.has(src)) hr_systems.add(src);

    // Extract from tags
    for (const tag of asset.tags ?? []) {
      const lower = tag.toLowerCase();
      if (KNOWN_LANGUAGES.has(lower)) languages.add(lower);
      if (KNOWN_FRAMEWORKS.has(lower)) frameworks.add(lower);
    }
  }

  const tech_stack_fingerprint = {
    languages: Array.from(languages),
    frameworks: Array.from(frameworks),
    cloud_providers: Array.from(cloud_providers),
    ai_providers: Array.from(ai_providers),
    automation_tools: Array.from(automation_tools),
    hr_systems: Array.from(hr_systems),
  };

  // 3. Build exposure_profile
  const prodAssets = typedAssets.filter((a) => a.environment === "production").length;
  const stagingAssets = typedAssets.filter((a) => a.environment === "staging").length;

  const allClassifications = new Set<string>();
  for (const a of typedAssets) {
    for (const dc of a.data_classification ?? []) allClassifications.add(dc);
  }

  const externalCount = typedAssets.filter(
    (a) => a.kind === "api" || a.kind === "integration" || (a.kind as string) === "webhook",
  ).length;

  const exposure_profile = {
    public_apis: externalCount,
    production_assets: prodAssets,
    staging_assets: stagingAssets,
    data_classifications: Array.from(allClassifications),
    external_integrations: externalCount,
  };

  // 4. Compute vulnerability vectors
  const allSignals = buildSignalSet(typedAssets);

  const vulnerability_vectors = ATTACK_VECTORS.map((vec) => {
    const matchingSignals = vec.tech_signals.filter((s) => allSignals.has(s));
    const signalRatio = matchingSignals.length / vec.tech_signals.length;

    // Score: signal match ratio * weight * 80, plus bonus for production assets
    let score = Math.round(signalRatio * vec.weight * 80);
    if (prodAssets > 0 && signalRatio > 0) score = Math.min(100, score + 15);
    if (allClassifications.has("phi") || allClassifications.has("pii")) {
      if (vec.id === "data_exfiltration" || vec.id === "credential_compromise") {
        score = Math.min(100, score + 10);
      }
    }

    return {
      vector_id: vec.id,
      name: vec.name,
      susceptibility_score: Math.max(0, Math.min(100, score)),
      factors: matchingSignals,
    };
  });

  // 5. Determine org size tier
  const assetCount = typedAssets.length;
  const asset_count_tier =
    assetCount <= 50
      ? "1-50"
      : assetCount <= 200
        ? "51-200"
        : assetCount <= 1000
          ? "201-1000"
          : "1000+";

  // 6. Compute genome hash for change detection
  const hashInput = JSON.stringify({ tech_stack_fingerprint, exposure_profile, vulnerability_vectors });
  const genome_hash = createHash("sha256").update(hashInput).digest("hex");

  // 7. Get current version
  const { data: existing } = await adminClient
    .from("threat_surface_genomes")
    .select("id, genome_version, genome_hash")
    .eq("org_id", orgId)
    .order("genome_version", { ascending: false })
    .limit(1)
    .single();

  // If hash unchanged, return existing
  if (existing && existing.genome_hash === genome_hash) {
    logger.info({ orgId }, "genome unchanged, skipping recomputation");
    return {
      id: (existing.id as string) ?? "",
      genome_version: existing.genome_version as number,
      genome_hash,
      vulnerability_vectors,
    };
  }

  const newVersion = ((existing?.genome_version as number) ?? 0) + 1;

  // 8. Upsert genome
  const { data: genome, error } = await adminClient
    .from("threat_surface_genomes")
    .insert({
      org_id: orgId,
      genome_version: newVersion,
      tech_stack_fingerprint,
      exposure_profile,
      vulnerability_vectors,
      asset_count_tier,
      genome_hash,
      computed_at: new Date().toISOString(),
    })
    .select("id, genome_version")
    .single();

  if (error) {
    logger.error({ error, orgId }, "genome-engine: failed to save genome");
    throw new Error("Failed to save genome: " + error.message);
  }

  // 9. Emit event
  const highVectors = vulnerability_vectors.filter((v) => v.susceptibility_score > 50).length;
  await emitEvent({
    orgId,
    kind: "asset_discovered" as any, // Will be 'genome_updated' after EventKind extension
    severity: "info",
    title: "Threat Surface Genome updated",
    body: `Genome v${newVersion} computed from ${assetCount} assets. ${highVectors} high-susceptibility vectors identified.`,
    metadata: { genome_version: newVersion, asset_count: assetCount },
  });

  logger.info({ orgId, version: newVersion, assetCount }, "genome computed");

  return {
    id: genome.id as string,
    genome_version: newVersion,
    genome_hash,
    vulnerability_vectors,
  };
}

/**
 * Retrieve the most recent genome for an organization.
 */
export async function getLatestGenome(orgId: string) {
  const { data } = await adminClient
    .from("threat_surface_genomes")
    .select("*")
    .eq("org_id", orgId)
    .order("genome_version", { ascending: false })
    .limit(1)
    .single();
  return data;
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

/**
 * Flatten all searchable signals from the asset list into a single set
 * for fast MITRE ATT&CK vector matching.
 */
function buildSignalSet(assets: Asset[]): Set<string> {
  const signals = new Set<string>();

  for (const a of assets) {
    signals.add(a.source?.toLowerCase() ?? "");
    signals.add(a.environment?.toLowerCase() ?? "");
    signals.add(a.kind?.toLowerCase() ?? "");

    for (const svc of a.ai_services ?? []) {
      signals.add(svc.provider.toLowerCase());
    }
    for (const dc of a.data_classification ?? []) {
      signals.add(dc.toLowerCase());
    }
    for (const tag of a.tags ?? []) {
      signals.add(tag.toLowerCase());
    }

    // Check raw_metadata scopes for privileged access signals
    const scopes = (a.raw_metadata?.scopes as string[]) ?? [];
    for (const s of scopes) {
      if (s.includes("write") || s.includes("admin") || s.includes("delete")) {
        signals.add("privileged");
      }
    }
  }

  return signals;
}
