/**
 * threat-intelligence/countermeasure-engine.ts -- Countermeasure Deployment
 *
 * Manages the lifecycle of countermeasure deployments: creation from
 * predictions, listing, retrieval, and rollback. Each deployment is
 * scoped to an organisation and optionally linked to a prediction or
 * shared threat intelligence record.
 */

import { adminClient } from "@/lib/supabase/admin";
import { emitEvent } from "@/lib/event-system";
import { logger } from "@/lib/logger";
import type { CountermeasureType, DeploymentStatus } from "./types";

// ---- Public API ---------------------------------------------------------------

/**
 * Deploy a countermeasure based on an attack prediction.
 *
 * Reads the prediction's recommended countermeasures, picks the highest-
 * priority one (or uses the provided type override), and creates a
 * deployment record.
 */
export async function deployCountermeasure(
  orgId: string,
  predictionId: string,
  options?: { auto?: boolean; countermeasure_type?: CountermeasureType },
): Promise<{
  id: string;
  status: DeploymentStatus;
  countermeasure_type: CountermeasureType;
}> {
  // Load the prediction
  const { data: prediction, error: predError } = await adminClient
    .from("attack_predictions")
    .select("*, threat_intel:shared_threat_intelligence(*)")
    .eq("id", predictionId)
    .eq("target_org_id", orgId)
    .single();

  if (predError || !prediction) {
    throw new Error("Prediction not found or not accessible");
  }

  // Determine countermeasure type
  const recommended = (prediction.recommended_countermeasures ?? []) as Array<{
    type: CountermeasureType;
    description: string;
    priority: string;
    auto_deployable: boolean;
  }>;

  const selectedType: CountermeasureType =
    options?.countermeasure_type ?? recommended[0]?.type ?? "alert_escalation";

  const deploymentPayload: Record<string, unknown> = {
    prediction_id: predictionId,
    threat_intel_id: prediction.threat_intel_id,
    recommended_countermeasures: recommended,
    selected_type: selectedType,
  };

  const { data: deployment, error: insertError } = await adminClient
    .from("countermeasure_deployments")
    .insert({
      org_id: orgId,
      threat_intel_id: prediction.threat_intel_id,
      prediction_id: predictionId,
      countermeasure_type: selectedType,
      deployment_payload: deploymentPayload,
      status: "deployed",
      auto_deployed: options?.auto ?? false,
      deployed_at: new Date().toISOString(),
      expires_at: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(), // 30-day TTL
    })
    .select("id, status, countermeasure_type")
    .single();

  if (insertError) {
    logger.error(
      { error: insertError, orgId, predictionId },
      "countermeasure-engine: failed to deploy",
    );
    throw new Error("Failed to deploy countermeasure: " + insertError.message);
  }

  // Update prediction status to mitigated
  await adminClient
    .from("attack_predictions")
    .update({ status: "mitigated" })
    .eq("id", predictionId);

  // Increment membership countermeasures_deployed
  const { data: membershipData } = await adminClient
    .from("network_memberships")
    .select("countermeasures_deployed")
    .eq("org_id", orgId)
    .single();

  if (membershipData) {
    await adminClient
      .from("network_memberships")
      .update({
        countermeasures_deployed:
          ((membershipData.countermeasures_deployed as number) ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId);
  }

  await emitEvent({
    orgId,
    kind: "task_created" as any, // Will be 'countermeasure_deployed'
    severity: "info",
    title: "Countermeasure deployed",
    body: `${selectedType} countermeasure deployed for prediction ${predictionId}.`,
    metadata: {
      deployment_id: deployment.id,
      prediction_id: predictionId,
      countermeasure_type: selectedType,
      auto_deployed: options?.auto ?? false,
    },
  });

  logger.info(
    { orgId, deploymentId: deployment.id, predictionId, type: selectedType },
    "countermeasure deployed",
  );

  return {
    id: deployment.id as string,
    status: deployment.status as DeploymentStatus,
    countermeasure_type: deployment.countermeasure_type as CountermeasureType,
  };
}

/**
 * List countermeasure deployments for an organisation.
 */
export async function listDeployments(
  orgId: string,
  options?: { limit?: number; offset?: number; status?: string },
): Promise<{ data: unknown[]; total: number }> {
  let q = adminClient
    .from("countermeasure_deployments")
    .select("*, prediction:attack_predictions(*)", { count: "exact" })
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (options?.status) q = q.eq("status", options.status);

  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;
  q = q.range(offset, offset + limit - 1);

  const { data, count } = await q;
  return { data: data ?? [], total: count ?? 0 };
}

/**
 * Retrieve a single deployment by ID, scoped to the org.
 */
export async function getDeployment(deploymentId: string, orgId: string) {
  const { data } = await adminClient
    .from("countermeasure_deployments")
    .select("*, prediction:attack_predictions(*)")
    .eq("id", deploymentId)
    .eq("org_id", orgId)
    .single();
  return data;
}

/**
 * Roll back a deployed countermeasure.
 */
export async function rollbackCountermeasure(
  deploymentId: string,
  orgId: string,
  reason: string,
): Promise<{ success: boolean }> {
  const { data: deployment, error: fetchError } = await adminClient
    .from("countermeasure_deployments")
    .select("id, status")
    .eq("id", deploymentId)
    .eq("org_id", orgId)
    .single();

  if (fetchError || !deployment) {
    logger.error(
      { deploymentId, orgId },
      "countermeasure-engine: deployment not found",
    );
    return { success: false };
  }

  if (
    deployment.status === "rolled_back" ||
    deployment.status === "expired"
  ) {
    logger.info(
      { deploymentId, currentStatus: deployment.status },
      "countermeasure-engine: deployment already inactive",
    );
    return { success: false };
  }

  const { error: updateError } = await adminClient
    .from("countermeasure_deployments")
    .update({
      status: "rolled_back",
      rolled_back_at: new Date().toISOString(),
      rollback_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deploymentId);

  if (updateError) {
    logger.error(
      { error: updateError, deploymentId },
      "countermeasure-engine: failed to rollback",
    );
    return { success: false };
  }

  await emitEvent({
    orgId,
    kind: "task_created" as any, // Will be 'countermeasure_rolled_back'
    severity: "medium",
    title: "Countermeasure rolled back",
    body: `Deployment ${deploymentId} rolled back. Reason: ${reason}`,
    metadata: { deployment_id: deploymentId, reason },
  });

  logger.info({ deploymentId, orgId, reason }, "countermeasure rolled back");
  return { success: true };
}
