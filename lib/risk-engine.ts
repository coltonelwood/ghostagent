import type { Asset, RiskLevel, RiskDimensionBreakdown } from "./types/platform";

export interface RiskContext {
  ownerActiveInHR: boolean | null;
  daysSinceLastSeen: number;
  daysSinceReview: number;
  openViolationCount: number;
  complianceGapCount: number;
}

export interface RiskScore {
  score: number;
  level: RiskLevel;
  breakdown: Record<string, RiskDimensionBreakdown>;
}

interface Dim {
  name: string;
  weight: number;
  /**
   * Returns a score on a 0-100 scale, where 100 means "worst case for this
   * dimension" and 0 means "completely clean". The scorer multiplies this by
   * weight to produce the final 0-100 asset score.
   */
  score(a: Asset, ctx: RiskContext): { score: number; explanation: string };
}

const APPROVED = new Set([
  "openai", "anthropic", "google", "azure", "aws", "cohere", "mistral",
]);
const SENSITIVE = new Set([
  "openai", "anthropic", "google", "azure-openai", "bedrock", "vertex-ai",
  "together-ai", "groq", "huggingface",
]);

// ---------------------------------------------------------------------------
// Dimensions — all return 0-100. Weights sum to 1.0 so the final score is
// directly 0-100. Previously dimensions returned raw point values which were
// then multiplied by weight, which capped the worst asset at ~15/100.
// ---------------------------------------------------------------------------

const DIMS: Dim[] = [
  {
    name: "ownership_health",
    weight: 0.25,
    score(a) {
      switch (a.owner_status) {
        case "orphaned":
          return { score: 100, explanation: "No active owner — orphaned" };
        case "inactive_owner":
          return { score: 80, explanation: "Owner no longer active" };
        case "reassignment_pending":
          return { score: 55, explanation: "Ownership reassignment pending" };
        case "unknown_owner":
          return { score: 60, explanation: "Owner not determined" };
        case "reviewed_unassigned":
          return { score: 30, explanation: "Explicitly unassigned" };
        default:
          return { score: 0, explanation: "Active owner" };
      }
    },
  },
  {
    name: "data_sensitivity",
    weight: 0.2,
    score(a) {
      const dc = a.data_classification ?? [];
      if (dc.includes("phi"))
        return { score: 100, explanation: "Handles PHI — HIPAA applies" };
      if (dc.includes("pii"))
        return { score: 80, explanation: "Handles PII" };
      if (dc.includes("financial"))
        return { score: 70, explanation: "Handles financial data" };
      if (dc.includes("internal"))
        return { score: 30, explanation: "Internal-only data" };
      return { score: 40, explanation: "Data classification unspecified" };
    },
  },
  {
    name: "external_exposure",
    weight: 0.12,
    score(a) {
      const svcs = (a.ai_services ?? []).map((s) => s.provider.toLowerCase());
      const unapproved = svcs.filter((s) => s && !APPROVED.has(s));
      if (unapproved.length > 0)
        return {
          score: 90,
          explanation: `Unapproved AI providers: ${unapproved.join(", ")}`,
        };
      if (svcs.some((s) => SENSITIVE.has(s)))
        return { score: 40, explanation: "Approved external AI providers" };
      return { score: 0, explanation: "No external AI providers" };
    },
  },
  {
    name: "environment_risk",
    weight: 0.1,
    score(a) {
      if (a.environment === "production")
        return { score: 80, explanation: "Running in production" };
      if (a.environment === "staging")
        return { score: 40, explanation: "Running in staging" };
      if (a.environment === "development")
        return { score: 10, explanation: "Development environment" };
      return { score: 50, explanation: "Environment unknown" };
    },
  },
  {
    name: "staleness",
    weight: 0.08,
    score(_, ctx) {
      const d = ctx.daysSinceLastSeen;
      if (d > 365) return { score: 90, explanation: `Not seen in ${d} days` };
      if (d > 180) return { score: 75, explanation: `Not seen in ${d} days` };
      if (d > 90) return { score: 55, explanation: `Not seen in ${d} days` };
      if (d > 30) return { score: 25, explanation: `Not seen in ${d} days` };
      return { score: 0, explanation: "Recently active" };
    },
  },
  {
    name: "privileged_access",
    weight: 0.08,
    score(a) {
      const scopes = (a.raw_metadata?.scopes as string[]) ?? [];
      if (
        scopes.some(
          (s) =>
            s.includes("write") ||
            s.includes("admin") ||
            s.includes("delete"),
        )
      )
        return { score: 90, explanation: "Has write/admin permissions" };
      if (scopes.length > 0)
        return { score: 40, explanation: "Read-only access" };
      return { score: 20, explanation: "Access scope unverified" };
    },
  },
  {
    name: "compliance_gaps",
    weight: 0.07,
    score(_, ctx) {
      const g = ctx.complianceGapCount;
      if (g === 0) return { score: 0, explanation: "No open compliance gaps" };
      if (g >= 5) return { score: 90, explanation: `${g} compliance gaps` };
      if (g >= 2) return { score: 60, explanation: `${g} compliance gaps` };
      return { score: 35, explanation: "1 compliance gap" };
    },
  },
  {
    name: "unreviewed_changes",
    weight: 0.05,
    score(_, ctx) {
      const d = ctx.daysSinceReview;
      if (!isFinite(d)) return { score: 80, explanation: "Never reviewed" };
      if (d > 180)
        return { score: 60, explanation: `Last reviewed ${d}d ago` };
      if (d > 90)
        return { score: 35, explanation: `Last reviewed ${d}d ago` };
      return { score: 0, explanation: `Reviewed ${d}d ago` };
    },
  },
  {
    name: "policy_violations",
    weight: 0.03,
    score(_, ctx) {
      const v = ctx.openViolationCount;
      if (v === 0) return { score: 0, explanation: "No open violations" };
      if (v >= 3) return { score: 90, explanation: `${v} open violations` };
      return { score: 60, explanation: `${v} open violation(s)` };
    },
  },
  {
    name: "provider_risk",
    weight: 0.02,
    score(a) {
      const svcs = (a.ai_services ?? []).map((s) => s.provider.toLowerCase());
      if (svcs.length === 0)
        return { score: 30, explanation: "No providers identified" };
      if (svcs.some((s) => s.includes("deprecated") || s === "unknown"))
        return { score: 80, explanation: "Deprecated or unknown provider" };
      return { score: 0, explanation: "Known active providers" };
    },
  },
];

/**
 * Thresholds — chosen so a single "bad" signal can push something into
 * medium but it takes multiple bad signals to reach high/critical. The
 * floor rules below can also escalate the level independent of the score.
 */
function thresholdLevel(n: number): RiskLevel {
  if (n >= 70) return "critical";
  if (n >= 50) return "high";
  if (n >= 25) return "medium";
  return "low";
}

/**
 * Floor rules — hard escalations that don't rely on the weighted math.
 * These exist so a single unambiguous signal (orphaned owner, PHI in
 * production) can't be diluted by other dimensions being fine.
 */
function applyFloor(level: RiskLevel, asset: Asset, ctx: RiskContext): RiskLevel {
  const order: RiskLevel[] = ["low", "medium", "high", "critical"];
  const raise = (to: RiskLevel) =>
    order.indexOf(to) > order.indexOf(level) ? to : level;

  const dc = asset.data_classification ?? [];
  const isPhi = dc.includes("phi");
  const isPii = dc.includes("pii");
  const isProd = asset.environment === "production";
  const isOrphaned = asset.owner_status === "orphaned";
  const isInactive = asset.owner_status === "inactive_owner";

  // PHI in production with anything other than a clean active owner → critical.
  if (isPhi && isProd && (isOrphaned || isInactive)) level = raise("critical");
  // PHI in production at all → at least high.
  else if (isPhi && isProd) level = raise("high");
  // Orphaned + production → at least high.
  else if (isOrphaned && isProd) level = raise("high");
  // Orphaned + PHI anywhere → at least high.
  else if (isOrphaned && isPhi) level = raise("high");
  // PII in production without an active owner → at least medium.
  else if (isPii && isProd && !isPhi && isOrphaned) level = raise("medium");

  // Many open violations → at least high.
  if (ctx.openViolationCount >= 3) level = raise("high");

  return level;
}

export function scoreAsset(asset: Asset, ctx: RiskContext): RiskScore {
  const breakdown: Record<string, RiskDimensionBreakdown> = {};
  let total = 0;
  for (const d of DIMS) {
    const { score: raw, explanation } = d.score(asset, ctx);
    const clamped = Math.max(0, Math.min(100, raw));
    breakdown[d.name] = { score: clamped, weight: d.weight, explanation };
    total += clamped * d.weight;
  }
  const final = Math.max(0, Math.min(100, Math.round(total)));
  const level = applyFloor(thresholdLevel(final), asset, ctx);
  return { score: final, level, breakdown };
}

export function buildRiskContext(
  asset: Asset,
  opts: {
    ownerActiveInHR?: boolean | null;
    openViolationCount?: number;
    complianceGapCount?: number;
  } = {},
): RiskContext {
  const now = Date.now();
  const daysSinceLastSeen = Math.floor(
    (now - new Date(asset.last_seen_at).getTime()) / 86400000,
  );
  const daysSinceReview = asset.reviewed_at
    ? Math.floor((now - new Date(asset.reviewed_at).getTime()) / 86400000)
    : Infinity;
  return {
    ownerActiveInHR: opts.ownerActiveInHR ?? null,
    daysSinceLastSeen,
    daysSinceReview,
    openViolationCount: opts.openViolationCount ?? 0,
    complianceGapCount: opts.complianceGapCount ?? 0,
  };
}
