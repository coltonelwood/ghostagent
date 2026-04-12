import { createHmac } from "crypto";
import { logger } from "@/lib/logger";

// The HMAC key is derived from the existing ENCRYPTION_KEY for simplicity
// In production, this should be a separate rotating key
function getHmacKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY required for anonymization");
  return key;
}

/**
 * Generate an unlinkable contributor hash from an org ID.
 * Uses HMAC-SHA256 so the hash can't be reversed to find the org.
 * Key rotation would make old hashes unlinkable to new ones.
 */
export function generateContributorHash(orgId: string): string {
  const hmac = createHmac("sha256", getHmacKey());
  hmac.update(orgId);
  return hmac.digest("hex").slice(0, 32); // Truncate for storage efficiency
}

/**
 * Anonymize a behavioral signature by:
 * 1. Removing any org-specific details from text fields
 * 2. Generalizing categorical data
 * 3. Adding differential privacy noise to numerical values
 */
export function anonymizeSignature(
  signature: Record<string, unknown>,
  anonymizationLevel: "full" | "partial" | "minimal" = "full",
): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(signature)); // Deep clone

  // Noise parameters based on anonymization level
  const epsilon = anonymizationLevel === "full" ? 0.5 : anonymizationLevel === "partial" ? 1.0 : 2.0;

  // Process tactics - keep structure but generalize specifics
  if (Array.isArray(result.tactics)) {
    result.tactics = result.tactics.map((t: Record<string, unknown>) => ({
      tactic: t.tactic, // Keep MITRE tactic category
      technique: t.technique, // Keep technique name
      procedure: anonymizationLevel === "full" ? "[redacted]" : t.procedure,
      mitre_id: t.mitre_id,
    }));
  }

  // Process communication patterns - add noise to confidence
  if (Array.isArray(result.communication_patterns)) {
    result.communication_patterns = result.communication_patterns.map((p: Record<string, unknown>) => ({
      ...p,
      confidence: addLaplaceNoise(p.confidence as number ?? 50, epsilon),
      indicators: anonymizationLevel === "full" ? [] : p.indicators,
    }));
  }

  // Process temporal patterns - add noise to confidence
  if (Array.isArray(result.temporal_patterns)) {
    result.temporal_patterns = result.temporal_patterns.map((p: Record<string, unknown>) => ({
      ...p,
      confidence: addLaplaceNoise(p.confidence as number ?? 50, epsilon),
      indicators: anonymizationLevel === "full" ? [] : p.indicators,
    }));
  }

  // Generalize target selection criteria
  if (Array.isArray(result.target_selection_criteria)) {
    result.target_selection_criteria = result.target_selection_criteria.map((c: string) =>
      generalizeCategory(c)
    );
  }

  return result;
}

/**
 * Generalize specific terms into broader categories for privacy.
 */
function generalizeCategory(term: string): string {
  const lower = term.toLowerCase();

  // Cloud providers
  if (["aws", "amazon", "ec2", "s3", "lambda"].some(k => lower.includes(k))) return "major cloud provider";
  if (["gcp", "google cloud", "vertex"].some(k => lower.includes(k))) return "major cloud provider";
  if (["azure", "microsoft cloud"].some(k => lower.includes(k))) return "major cloud provider";

  // Company sizes
  if (["fortune 500", "large enterprise", "multinational"].some(k => lower.includes(k))) return "large organization";
  if (["small business", "startup", "smb"].some(k => lower.includes(k))) return "small organization";

  // Industries
  if (["bank", "financial", "fintech", "trading"].some(k => lower.includes(k))) return "financial services";
  if (["hospital", "health", "medical", "pharma"].some(k => lower.includes(k))) return "healthcare";
  if (["school", "university", "education"].some(k => lower.includes(k))) return "education";

  return term; // Keep as-is if no generalization applies
}

/**
 * Add Laplace noise for differential privacy.
 * Epsilon controls the privacy/utility tradeoff:
 * - Lower epsilon = more noise = more privacy
 * - Higher epsilon = less noise = more utility
 */
function addLaplaceNoise(value: number, epsilon: number): number {
  const sensitivity = 10; // Confidence scores range 0-100, sensitivity = max change
  const scale = sensitivity / epsilon;

  // Laplace distribution sampling via inverse CDF
  const u = Math.random() - 0.5;
  const noise = -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));

  return Math.max(0, Math.min(100, Math.round(value + noise)));
}

/**
 * Generalize industry classification for genome sharing.
 */
export function generalizeIndustry(industry: string | null): string {
  if (!industry) return "unspecified";
  const lower = industry.toLowerCase();
  if (lower.includes("tech") || lower.includes("software")) return "technology";
  if (lower.includes("financ") || lower.includes("bank")) return "financial_services";
  if (lower.includes("health") || lower.includes("medical")) return "healthcare";
  if (lower.includes("retail") || lower.includes("ecommerce")) return "retail";
  if (lower.includes("government") || lower.includes("public")) return "government";
  if (lower.includes("education") || lower.includes("academic")) return "education";
  if (lower.includes("manufactur") || lower.includes("industrial")) return "manufacturing";
  return "other";
}

/**
 * Generalize tech stack for genome sharing.
 */
export function generalizeTechStack(techStack: Record<string, string[]>): string[] {
  const generalized: string[] = [];
  if ((techStack.cloud_providers ?? []).length > 0) generalized.push("uses_cloud");
  if ((techStack.ai_providers ?? []).length > 0) generalized.push("uses_ai");
  if ((techStack.automation_tools ?? []).length > 0) generalized.push("uses_automation");
  if ((techStack.languages ?? []).length > 0) generalized.push("has_code_assets");
  return generalized;
}
