import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { adminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Internal threat intelligence worker.
 * Runs periodically via cron to handle:
 * 1. Genome recomputation for orgs with recent asset changes
 * 2. Prediction generation for new shared intelligence
 * 3. Expired countermeasure cleanup
 * 4. Stale intelligence TTL expiration
 *
 * Protected by INTERNAL_API_KEY (same as other internal routes).
 */
export const POST = withLogging(async (req: NextRequest) => {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};
  const now = new Date().toISOString();

  try {
    // 1. Expire stale shared intelligence past TTL
    const { data: expiredIntelRows } = await adminClient
      .from("shared_threat_intelligence")
      .update({ status: "mitigated", updated_at: now })
      .lt("ttl_expires_at", now)
      .eq("status", "active")
      .select("id");
    results.expired_intel = expiredIntelRows?.length ?? 0;

    // 2. Expire old countermeasure deployments
    const { data: expiredDeploymentRows } = await adminClient
      .from("countermeasure_deployments")
      .update({ status: "expired", updated_at: now })
      .lt("expires_at", now)
      .in("status", ["deployed", "active"])
      .select("id");
    results.expired_deployments = expiredDeploymentRows?.length ?? 0;

    // 3. Expire old predictions
    const { data: expiredPredictionRows } = await adminClient
      .from("attack_predictions")
      .update({ status: "expired" })
      .lt("expires_at", now)
      .eq("status", "pending")
      .select("id");
    results.expired_predictions = expiredPredictionRows?.length ?? 0;

    // 4. Generate predictions for recent unprocessed shared intelligence
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentIntel } = await adminClient
      .from("shared_threat_intelligence")
      .select("id")
      .gte("first_seen_network_at", oneHourAgo)
      .eq("status", "active");

    let predictionsGenerated = 0;
    if (recentIntel?.length) {
      // Lazy-import to avoid circular deps and keep cold starts fast
      const { generatePredictions } = await import("@/lib/threat-intelligence/prediction-engine");
      for (const intel of recentIntel) {
        try {
          const preds = await generatePredictions(intel.id);
          predictionsGenerated += preds.predictions.length;
        } catch (err) {
          logger.error({ err, intelId: intel.id }, "threat-worker: prediction generation failed");
        }
      }
    }
    results.predictions_generated = predictionsGenerated;

    logger.info(results, "threat-worker: cycle complete");
    return NextResponse.json({ ok: true, ...results });
  } catch (err) {
    logger.error({ err }, "threat-worker: cycle failed");
    return NextResponse.json({ error: "Worker cycle failed" }, { status: 500 });
  }
});
