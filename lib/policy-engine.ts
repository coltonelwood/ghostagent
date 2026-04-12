import type { Asset, Policy, PolicyConditionGroup, PolicyRule, PolicySeverity, PolicyAction } from "./types/platform";
import { adminClient } from "./supabase/admin";
import { emitEvent } from "./event-system";
import { logger } from "./logger";

type FieldVal = string | number | boolean | string[] | null | undefined;

function getField(a: Asset, field: string): FieldVal {
  switch (field) {
    case "owner_status": return a.owner_status;
    case "risk_level": return a.risk_level;
    case "risk_score": return a.risk_score;
    case "source": return a.source;
    case "environment": return a.environment;
    case "status": return a.status;
    case "review_status": return a.review_status;
    case "kind": return a.kind;
    case "data_classification": return a.data_classification;
    case "tags": return a.tags;
    case "compliance_tags": return a.compliance_tags;
    case "owner_email": return a.owner_email;
    case "days_since_review":
      return a.reviewed_at ? Math.floor((Date.now()-new Date(a.reviewed_at).getTime())/86400000) : Infinity;
    case "days_since_seen":
      return Math.floor((Date.now()-new Date(a.last_seen_at).getTime())/86400000);
    case "ai_provider":
      return (a.ai_services??[]).map(s=>s.provider.toLowerCase());
    // Collective defense fields — enable policies based on network threat intelligence
    case "threat_exposure_score":
      return (a as Asset & { _threat_exposure_score?: number })._threat_exposure_score ?? 0;
    case "active_predictions_count":
      return (a as Asset & { _active_predictions_count?: number })._active_predictions_count ?? 0;
    default: return undefined;
  }
}

function evalRule(r: PolicyRule, a: Asset): boolean {
  const v = getField(a, r.field);
  const t = r.value;
  switch (r.op) {
    case "eq": return v === t;
    case "neq": return v !== t;
    case "gt": return typeof v==="number" && v>(t as number);
    case "lt": return typeof v==="number" && v<(t as number);
    case "gte": return typeof v==="number" && v>=(t as number);
    case "lte": return typeof v==="number" && v<=(t as number);
    case "is_null": return v===null||v===undefined;
    case "is_not_null": return v!==null&&v!==undefined;
    case "contains": return Array.isArray(v)?v.includes(t as string):typeof v==="string"&&v.includes(t as string);
    case "not_contains": return Array.isArray(v)?!v.includes(t as string):typeof v==="string"&&!v.includes(t as string);
    case "in": return Array.isArray(t)&&(Array.isArray(v)?v.some(x=>(t as unknown[]).includes(x)):(t as unknown[]).includes(v));
    case "not_in": return !Array.isArray(t)||!(Array.isArray(v)?v.some(x=>(t as unknown[]).includes(x)):(t as unknown[]).includes(v));
    default: return false;
  }
}

function evalGroup(g: PolicyConditionGroup, a: Asset): boolean {
  const results = g.rules.map(r => "operator" in r ? evalGroup(r as PolicyConditionGroup, a) : evalRule(r as PolicyRule, a));
  return g.operator==="AND" ? results.every(Boolean) : results.some(Boolean);
}

function matchesScope(p: Policy, a: Asset): boolean {
  const s = p.scope??{};
  if (s.sources?.length && !s.sources.includes(a.source as never)) return false;
  if (s.environments?.length && !s.environments.includes(a.environment)) return false;
  if (s.tags?.length && !s.tags.some((t: string) => (a.tags??[]).includes(t))) return false;
  return true;
}

export function evaluatePolicy(p: Policy, a: Asset): boolean {
  if (!p.enabled) return false;
  if (!matchesScope(p, a)) return false;
  return evalGroup(p.conditions, a);
}

export async function runPoliciesForOrg(orgId: string, assetIds?: string[]): Promise<{created:number;resolved:number}> {
  const {data:policies} = await adminClient.from("policies").select("*").eq("org_id",orgId).eq("enabled",true);
  if (!policies?.length) return {created:0,resolved:0};

  let q = adminClient.from("assets").select("*").eq("org_id",orgId).eq("status","active");
  if (assetIds?.length) q = q.in("id",assetIds);
  const {data:assets} = await q;
  if (!assets?.length) return {created:0,resolved:0};

  let created=0, resolved=0;

  for (const policy of policies) {
    const typedPolicy = policy as unknown as Policy;
    const violating = new Set<string>();

    for (const asset of assets) {
      if (evaluatePolicy(typedPolicy, asset as unknown as Asset)) violating.add(asset.id);
    }

    // Get asset details for action dispatch (only for new violations)
    const assetDetails: Record<string, Asset> = {};
    if (violating.size > 0) {
      const {data:assetRows} = await adminClient.from("assets").select("*").in("id", Array.from(violating));
      for (const a of assetRows ?? []) assetDetails[a.id] = a as unknown as Asset;
    }

    for (const assetId of violating) {
      // Check if this is a new violation
      const {data:existing} = await adminClient.from("policy_violations")
        .select("id").eq("policy_id", policy.id).eq("asset_id", assetId).eq("status", "open").single();

      const {error} = await adminClient.from("policy_violations").upsert({
        policy_id: policy.id, asset_id: assetId, org_id: orgId,
        status:"open", severity:policy.severity, last_detected_at:new Date().toISOString(),
        details:{policy_name:policy.name},
      },{onConflict:"policy_id,asset_id"});
      if (!error) created++;

      // Dispatch policy actions only for newly detected violations
      if (!existing && !typedPolicy.dry_run_mode) {
        const asset = assetDetails[assetId];
        if (asset) {
          await dispatchPolicyActions(typedPolicy, asset, orgId).catch(e =>
            logger.error({e, policyId: policy.id, assetId}, "policy action dispatch failed")
          );
        }
      }
    }

    const {data:open} = await adminClient.from("policy_violations")
      .select("id,asset_id").eq("policy_id",policy.id).eq("org_id",orgId).eq("status","open");
    for (const v of open??[]) {
      const tv = v as {id:string;asset_id:string};
      if (!violating.has(tv.asset_id)) {
        await adminClient.from("policy_violations")
          .update({status:"resolved",resolved_at:new Date().toISOString()}).eq("id",tv.id);
        resolved++;
      }
    }

    await adminClient.from("policies")
      .update({last_run_at:new Date().toISOString(),last_run_violations:violating.size}).eq("id",policy.id);
  }

  logger.info({orgId,created,resolved},"policy_engine: run complete");
  return {created,resolved};
}

/**
 * Execute all actions defined in a policy for a violating asset.
 */
async function dispatchPolicyActions(policy: Policy, asset: Asset, orgId: string): Promise<void> {
  const actions: PolicyAction[] = policy.actions ?? [];
  if (!actions.length) return;

  for (const action of actions) {
    try {
      switch (action.type) {
        case "alert_owner": {
          if (!asset.owner_email) break;
          await emitEvent({
            orgId, kind: "policy_violated", severity: policy.severity,
            title: "Policy violation: " + policy.name,
            body: "Asset " + asset.name + " violates policy. Owner: " + asset.owner_email,
            assetId: asset.id, policyId: policy.id,
            metadata: { action: "alert_owner", owner_email: asset.owner_email },
          });
          break;
        }
        case "alert_admin": {
          await emitEvent({
            orgId, kind: "policy_violated", severity: policy.severity,
            title: "Policy violation: " + policy.name,
            body: "Asset " + asset.name + " requires admin attention.",
            assetId: asset.id, policyId: policy.id,
            metadata: { action: "alert_admin" },
          });
          break;
        }
        case "alert_slack":
        case "alert_webhook": {
          // Routed through emitEvent → event-system → alert_preferences dispatch
          await emitEvent({
            orgId, kind: "policy_violated", severity: policy.severity,
            title: "Policy violation: " + policy.name,
            body: "Asset: " + asset.name + " | Source: " + asset.source + " | Risk: " + asset.risk_level,
            assetId: asset.id, policyId: policy.id,
            metadata: { action: action.type, asset_source: asset.source, asset_risk: asset.risk_level },
          });
          break;
        }
        case "create_task": {
          await adminClient.from("tasks").insert({
            org_id: orgId,
            asset_id: asset.id,
            title: "Resolve policy violation: " + policy.name,
            description: "Asset \"" + asset.name + "\" violates policy \"" + policy.name + "\". Review and remediate.",
            status: "open",
            priority: policy.severity === "critical" ? "critical" : policy.severity === "high" ? "high" : "medium",
            assigned_to: null,
            created_by: "00000000-0000-0000-0000-000000000000", // system
            due_at: policy.severity === "critical"
              ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h for critical
              : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days otherwise
          });
          break;
        }
        case "mark_flagged": {
          await adminClient.from("assets")
            .update({ review_status: "flagged", last_changed_at: new Date().toISOString() })
            .eq("id", asset.id);
          break;
        }
        case "quarantine": {
          // Mark asset as quarantined in DB; connector-level quarantine requires separate call
          await adminClient.from("assets")
            .update({ status: "quarantined", last_changed_at: new Date().toISOString() })
            .eq("id", asset.id);
          await emitEvent({
            orgId, kind: "asset_quarantined", severity: "critical",
            title: "Asset quarantined by policy: " + policy.name,
            assetId: asset.id, policyId: policy.id,
          });
          break;
        }
        case "deploy_countermeasure": {
          // Collective defense: emit event for manual countermeasure review
          await emitEvent({
            orgId, kind: "countermeasure_deployed", severity: policy.severity,
            title: "Countermeasure triggered by policy: " + policy.name,
            body: "Asset " + asset.name + " triggered an automated countermeasure deployment.",
            assetId: asset.id, policyId: policy.id,
            metadata: { action: "deploy_countermeasure", asset_risk: asset.risk_level },
          });
          break;
        }
      }
    } catch (err) {
      logger.error({ err, action: action.type, assetId: asset.id }, "policy action failed");
    }
  }
}

export async function dryRunPolicy(policy: Policy, orgId: string): Promise<{matchingAssetIds:string[];matchCount:number}> {
  const {data:assets} = await adminClient.from("assets").select("*").eq("org_id",orgId).eq("status","active");
  const matching: string[] = [];
  for (const a of assets??[]) {
    if (evaluatePolicy(policy, a as unknown as Asset)) matching.push(a.id);
  }
  return {matchingAssetIds:matching,matchCount:matching.length};
}

export function severityColor(severity: PolicySeverity): string {
  switch(severity){case"critical":case"high":return"destructive";case"medium":return"warning";default:return"default";}
}

/** Alias: evaluate all policies = runPoliciesForOrg with no asset filter */
export async function evaluateAllPolicies(orgId: string): Promise<{violations: unknown[]; processed: number}> {
  const result = await runPoliciesForOrg(orgId);
  return { violations: [], processed: result.created + result.resolved };
}

/** Alias: run all policies = evaluateAllPolicies */
export async function runAllPolicies(orgId: string): Promise<void> {
  await runPoliciesForOrg(orgId);
}

/** Run a single policy and return violations */
export async function runPolicy(policyId: string, orgId: string, dryRun?: boolean): Promise<{
  violations: Array<{assetId: string; assetName: string; details: Record<string, unknown>}>;
  total: number;
}> {
  const {data: policy} = await adminClient.from("policies").select("*").eq("id", policyId).eq("org_id", orgId).single();
  if (!policy) return {violations: [], total: 0};

  const typedPolicy = policy as unknown as Policy;

  if (dryRun) {
    const result = await dryRunPolicy(typedPolicy, orgId);
    return {
      violations: result.matchingAssetIds.map(id => ({assetId: id, assetName: id, details: {policy_name: typedPolicy.name}})),
      total: result.matchCount,
    };
  }

  const {data: assets} = await adminClient.from("assets").select("*").eq("org_id", orgId).eq("status", "active");
  const violations: Array<{assetId: string; assetName: string; details: Record<string, unknown>}> = [];

  for (const asset of assets ?? []) {
    const typedAsset = asset as unknown as Asset;
    if (evaluatePolicy(typedPolicy, typedAsset)) {
      violations.push({
        assetId: typedAsset.id,
        assetName: typedAsset.name,
        details: {
          policy_name: typedPolicy.name, policy_severity: typedPolicy.severity,
          asset_source: typedAsset.source, asset_environment: typedAsset.environment,
        },
      });
    }
  }

  // Persist violations
  const now = new Date().toISOString();
  for (const v of violations) {
    await adminClient.from("policy_violations").upsert({
      policy_id: policyId, asset_id: v.assetId, org_id: orgId,
      status: "open", severity: typedPolicy.severity,
      last_detected_at: now, details: v.details,
    }, {onConflict: "policy_id,asset_id"});
  }

  await adminClient.from("policies").update({
    last_run_at: now, last_run_violations: violations.length,
  }).eq("id", policyId);

  return {violations, total: violations.length};
}
