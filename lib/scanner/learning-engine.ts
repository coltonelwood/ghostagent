/**
 * learning-engine.ts
 *
 * Continuous learning system for the scanner.
 *
 * Tracks:
 * - Patterns that produce high-value findings (confirm → boost)
 * - Patterns that produce false positives (dismiss → suppress)
 * - Patterns that consistently miss a class of risk (gap → generate new patterns)
 *
 * Stored in DB: scanner_pattern_stats table
 * Updated: after every scan + user feedback
 */

import { adminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export interface PatternFeedback {
  query: string;
  orgId: string;
  scanId: string;
  assetId: string;
  outcome: "confirmed" | "dismissed" | "escalated";
  userNote?: string;
}

export interface PatternStats {
  query: string;
  total_hits: number;
  confirmed_hits: number;
  dismissed_hits: number;
  escalated_hits: number;
  precision: number;        // confirmed / total
  last_updated: string;
  suppressed: boolean;      // auto-suppressed if precision < 0.1
}

/**
 * Record the outcome of a pattern hit (called when user marks an asset).
 */
export async function recordPatternFeedback(feedback: PatternFeedback): Promise<void> {
  try {
    const { data: existing } = await adminClient
      .from("scanner_pattern_stats")
      .select("*")
      .eq("query", feedback.query)
      .single();

    if (existing) {
      const updates: Record<string, unknown> = {
        total_hits: (existing.total_hits ?? 0) + 1,
        last_updated: new Date().toISOString(),
      };
      if (feedback.outcome === "confirmed")  updates.confirmed_hits  = (existing.confirmed_hits ?? 0) + 1;
      if (feedback.outcome === "dismissed")  updates.dismissed_hits  = (existing.dismissed_hits ?? 0) + 1;
      if (feedback.outcome === "escalated")  updates.escalated_hits  = (existing.escalated_hits ?? 0) + 1;

      const total = (updates.total_hits as number);
      const confirmed = (updates.confirmed_hits as number) ?? existing.confirmed_hits ?? 0;
      updates.precision = total > 0 ? confirmed / total : 0;

      // Auto-suppress if precision < 10% with >= 20 hits — too noisy
      if (total >= 20 && (updates.precision as number) < 0.10) {
        updates.suppressed = true;
        logger.warn({ query: feedback.query, precision: updates.precision }, "learning: auto-suppressing low-precision pattern");
      }

      await adminClient.from("scanner_pattern_stats").update(updates).eq("query", feedback.query);
    } else {
      await adminClient.from("scanner_pattern_stats").insert({
        query: feedback.query,
        total_hits: 1,
        confirmed_hits:  feedback.outcome === "confirmed"  ? 1 : 0,
        dismissed_hits:  feedback.outcome === "dismissed"  ? 1 : 0,
        escalated_hits:  feedback.outcome === "escalated"  ? 1 : 0,
        precision: feedback.outcome === "confirmed" ? 1.0 : 0.0,
        suppressed: false,
        last_updated: new Date().toISOString(),
      });
    }
  } catch (err) {
    logger.error({ err }, "learning: failed to record pattern feedback");
  }
}

/**
 * Get suppressed patterns (to exclude from scans).
 * Called at scan start to skip low-signal patterns.
 */
export async function getSuppressedPatterns(): Promise<Set<string>> {
  try {
    const { data } = await adminClient
      .from("scanner_pattern_stats")
      .select("query")
      .eq("suppressed", true);
    return new Set((data ?? []).map((r: { query: string }) => r.query));
  } catch {
    return new Set(); // Fail open — don't suppress if DB unavailable
  }
}

/**
 * Get pattern boost weights (high-precision patterns get more attention in scoring).
 * Returns map of query → boost multiplier (1.0 = default, 1.5 = high precision)
 */
export async function getPatternBoosts(): Promise<Map<string, number>> {
  try {
    const { data } = await adminClient
      .from("scanner_pattern_stats")
      .select("query, precision, confirmed_hits")
      .eq("suppressed", false)
      .gte("confirmed_hits", 5);

    const boosts = new Map<string, number>();
    for (const row of data ?? []) {
      if (row.precision >= 0.8) boosts.set(row.query, 1.5);       // very high precision
      else if (row.precision >= 0.6) boosts.set(row.query, 1.2);   // good precision
    }
    return boosts;
  } catch {
    return new Map();
  }
}

/**
 * Record a scan's findings for trend analysis.
 * Called after every scan completes.
 */
export async function recordScanMetrics(metrics: {
  orgId: string;
  scanId: string;
  totalFound: number;
  byClass: Record<string, number>;
  byRisk: Record<string, number>;
}): Promise<void> {
  try {
    await adminClient.from("scanner_scan_metrics").insert({
      org_id: metrics.orgId,
      scan_id: metrics.scanId,
      total_found: metrics.totalFound,
      by_class: metrics.byClass,
      by_risk: metrics.byRisk,
      scanned_at: new Date().toISOString(),
    });
  } catch {
    // Non-critical — don't fail scans because of metrics
  }
}

/**
 * Generate improvement suggestions based on accumulated miss patterns.
 * Called by admin dashboard to surface "add these patterns" suggestions.
 */
export async function generateImprovementSuggestions(): Promise<Array<{
  suggestion: string;
  reason: string;
  priority: "high" | "medium" | "low";
}>> {
  const suggestions: Array<{ suggestion: string; reason: string; priority: "high" | "medium" | "low" }> = [];

  try {
    // Patterns with high escalation rate (users escalate → scanner underscored the risk)
    const { data: escalated } = await adminClient
      .from("scanner_pattern_stats")
      .select("*")
      .gte("escalated_hits", 3)
      .order("escalated_hits", { ascending: false })
      .limit(10);

    for (const row of escalated ?? []) {
      suggestions.push({
        suggestion: `Increase risk floor for pattern: "${row.query}"`,
        reason: `Escalated ${row.escalated_hits} times — users consistently rate this higher than scanner does`,
        priority: "high",
      });
    }

    // Suppressed patterns that used to be good (precision dropped — needs redesign)
    const { data: suppressed } = await adminClient
      .from("scanner_pattern_stats")
      .select("*")
      .eq("suppressed", true)
      .gte("confirmed_hits", 5) // Had value at some point
      .limit(5);

    for (const row of suppressed ?? []) {
      suggestions.push({
        suggestion: `Redesign suppressed pattern: "${row.query}"`,
        reason: `Pattern has ${row.confirmed_hits} confirmed hits but ${row.dismissed_hits} dismissals — too broad, needs tighter matching`,
        priority: "medium",
      });
    }
  } catch {
    // Return empty if DB unavailable
  }

  return suggestions;
}
