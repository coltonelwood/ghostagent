/**
 * threat-intelligence/fingerprint-engine.ts — Behavioral fingerprint extraction
 *
 * Extracts behavioral fingerprints from threat observations using configurable
 * AI (see ai-provider.ts). Fingerprints capture the attack methodology — HOW
 * an attack works — rather than specific IOCs that adversaries rotate.
 *
 * Includes TTP-based similarity matching against the shared threat
 * intelligence network for cross-organisation correlation.
 */

import { adminClient } from "@/lib/supabase/admin";
import { emitEvent } from "@/lib/event-system";
import { logger } from "@/lib/logger";
import { getAIProvider } from "./ai-provider";
import type { BehavioralSignature, ThreatObservation } from "./types";

// ─── SYSTEM PROMPT ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a cybersecurity behavioral analyst. Given a threat observation, extract the behavioral DNA of the attack — the underlying methodology, not specific indicators.

Return a JSON object with this exact structure:
{
  "tactics": [{ "tactic": "string (MITRE ATT&CK tactic)", "technique": "string", "procedure": "string (specific implementation)", "mitre_id": "string (e.g., T1566.001)" }],
  "communication_patterns": [{ "type": "string", "description": "string", "indicators": ["string"], "confidence": number (0-100) }],
  "temporal_patterns": [{ "type": "string", "description": "string", "indicators": ["string"], "confidence": number (0-100) }],
  "evasion_techniques": ["string"],
  "target_selection_criteria": ["string"],
  "payload_characteristics": ["string"]
}

Focus on the behavioral methodology — HOW the attack works, not the specific IOCs (IPs, domains) that can be rotated. Extract patterns that would identify this same attack methodology even with different infrastructure.`;

// ─── PUBLIC API ─────────────────────────────────────────────────────────────

/**
 * Extract a behavioral fingerprint from a threat observation using AI.
 *
 * Falls back to a minimal heuristic-based signature when AI extraction
 * fails so callers always receive a usable result.
 */
export async function extractBehavioralFingerprint(
  orgId: string,
  observation: ThreatObservation,
): Promise<{ id: string; fingerprint: BehavioralSignature; confidence: number }> {
  const ai = getAIProvider();

  const userPrompt = `Analyze this threat observation and extract the behavioral fingerprint:

Type: ${observation.type}
Indicators: ${observation.indicators.join(", ")}
Timeline: ${observation.timeline}
Narrative: ${observation.narrative}
${observation.raw_evidence ? `Raw Evidence: ${observation.raw_evidence.slice(0, 2000)}` : ""}
${observation.affected_assets?.length ? `Affected Assets: ${observation.affected_assets.join(", ")}` : ""}`;

  let signature: BehavioralSignature;
  let confidence = 0;

  try {
    const raw = await ai.analyze(SYSTEM_PROMPT, userPrompt);
    signature = JSON.parse(raw) as BehavioralSignature;

    // Compute confidence based on completeness of extraction
    let signals = 0;
    if (signature.tactics?.length) signals += 30;
    if (signature.communication_patterns?.length) signals += 20;
    if (signature.temporal_patterns?.length) signals += 15;
    if (signature.evasion_techniques?.length) signals += 15;
    if (signature.target_selection_criteria?.length) signals += 10;
    if (signature.payload_characteristics?.length) signals += 10;
    confidence = Math.min(100, signals);
  } catch (err) {
    logger.error({ err, orgId }, "fingerprint-engine: AI extraction failed");

    // Fallback: create a basic signature from the observation
    signature = {
      tactics: [
        {
          tactic: "Initial Access",
          technique: observation.type,
          procedure: observation.narrative.slice(0, 200),
        },
      ],
      communication_patterns: [],
      temporal_patterns: [],
      evasion_techniques: [],
      target_selection_criteria: [],
      payload_characteristics: observation.indicators.slice(0, 5),
    };
    confidence = 20;
  }

  const severity = observation.severity ?? "medium";

  const { data, error } = await adminClient
    .from("threat_behavioral_fingerprints")
    .insert({
      reporting_org_id: orgId,
      fingerprint_type: observation.type,
      behavioral_signature: signature,
      confidence,
      ioc_count: observation.indicators.length,
      severity,
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    logger.error({ error, orgId }, "fingerprint-engine: failed to save fingerprint");
    throw new Error("Failed to save fingerprint: " + error.message);
  }

  await emitEvent({
    orgId,
    kind: "asset_discovered" as any, // Will be 'threat_detected' after EventKind extension
    severity: severity as any,
    title: "New threat behavioral fingerprint extracted",
    body: `${observation.type} attack pattern identified with ${confidence}% confidence. ${signature.tactics.length} TTPs extracted.`,
    metadata: { fingerprint_id: data.id, type: observation.type, confidence },
  });

  logger.info(
    { orgId, fingerprintId: data.id, type: observation.type, confidence },
    "fingerprint extracted",
  );

  return { id: data.id as string, fingerprint: signature, confidence };
}

/**
 * Retrieve a single fingerprint by ID, scoped to the reporting org.
 */
export async function getFingerprint(fingerprintId: string, orgId: string) {
  const { data } = await adminClient
    .from("threat_behavioral_fingerprints")
    .select("*")
    .eq("id", fingerprintId)
    .eq("reporting_org_id", orgId)
    .single();
  return data;
}

/**
 * Paginated listing of fingerprints for an organisation, with optional
 * filters on type and status.
 */
export async function listFingerprints(
  orgId: string,
  options?: { limit?: number; offset?: number; type?: string; status?: string },
) {
  let q = adminClient
    .from("threat_behavioral_fingerprints")
    .select("*", { count: "exact" })
    .eq("reporting_org_id", orgId)
    .order("created_at", { ascending: false });

  if (options?.type) q = q.eq("fingerprint_type", options.type);
  if (options?.status) q = q.eq("status", options.status);
  if (options?.limit) q = q.limit(options.limit);
  if (options?.offset) q = q.range(options.offset, options.offset + (options.limit ?? 20) - 1);

  const { data, count } = await q;
  return { data: data ?? [], total: count ?? 0 };
}

// ─── SIMILARITY MATCHING ────────────────────────────────────────────────────

/**
 * Match a behavioral signature against the shared threat intelligence pool
 * using TTP overlap as a similarity metric.
 *
 * Uses Jaccard similarity on TTP keys (tactic:technique) weighted at 70%
 * and evasion technique overlap weighted at 30%.
 */
export async function matchFingerprints(
  signature: BehavioralSignature,
  threshold: number = 40,
): Promise<Array<{ id: string; similarity: number; fingerprint_type: string; severity: string }>> {
  const { data: shared } = await adminClient
    .from("shared_threat_intelligence")
    .select("id, behavioral_signature, fingerprint_type, severity")
    .eq("status", "active");

  if (!shared?.length) return [];

  const sourceTTPs = new Set(
    (signature.tactics ?? []).map((t) => `${t.tactic}:${t.technique}`.toLowerCase()),
  );
  const sourceEvasion = new Set(
    (signature.evasion_techniques ?? []).map((e) => e.toLowerCase()),
  );

  const matches: Array<{ id: string; similarity: number; fingerprint_type: string; severity: string }> = [];

  for (const item of shared) {
    const target = item.behavioral_signature as unknown as BehavioralSignature;

    // Jaccard similarity on TTPs (weighted 70%)
    const targetTTPs = new Set(
      (target.tactics ?? []).map((t: { tactic: string; technique: string }) =>
        `${t.tactic}:${t.technique}`.toLowerCase(),
      ),
    );
    const ttpIntersection = [...sourceTTPs].filter((t) => targetTTPs.has(t)).length;
    const ttpUnion = new Set([...sourceTTPs, ...targetTTPs]).size;
    const ttpSimilarity = ttpUnion > 0 ? (ttpIntersection / ttpUnion) * 70 : 0;

    // Evasion technique overlap (weighted 30%)
    const targetEvasion = new Set(
      (target.evasion_techniques ?? []).map((e: string) => e.toLowerCase()),
    );
    const evasionIntersection = [...sourceEvasion].filter((e) => targetEvasion.has(e)).length;
    const evasionUnion = new Set([...sourceEvasion, ...targetEvasion]).size;
    const evasionSimilarity = evasionUnion > 0 ? (evasionIntersection / evasionUnion) * 30 : 0;

    const similarity = Math.round(ttpSimilarity + evasionSimilarity);

    if (similarity >= threshold) {
      matches.push({
        id: item.id as string,
        similarity,
        fingerprint_type: item.fingerprint_type as string,
        severity: item.severity as string,
      });
    }
  }

  return matches.sort((a, b) => b.similarity - a.similarity);
}
