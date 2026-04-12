import { adminClient } from "./supabase/admin";
import { getConnector, isHRConnector } from "./connectors";
import { decryptCredentials } from "./crypto";
import { scoreAsset, buildRiskContext } from "./risk-engine";
import { resolveOwnership, shouldMarkOrphaned } from "./ownership-engine";
import { runPoliciesForOrg } from "./policy-engine";
import { autoMapCompliance } from "./compliance/auto-mapper";
import { emitEvent } from "./event-system";
import { getPlanLimits } from "./entitlements";
import { getOrgAssetCount } from "./org";
import { cronToIntervalMs } from "./cron-utils";
import { logger } from "./logger";
import type {
  Asset,
  Connector,
  HREmployee,
  NormalizedAsset,
  Organization,
} from "./types/platform";

/**
 * Hard ceiling on assets persisted per single sync. Protects the DB, the
 * risk engine loop, and memory on huge orgs. If we hit this, we log and
 * surface a truncation notice on the connector so the operator knows.
 */
const MAX_ASSETS_PER_SYNC = 2_000;

export async function syncConnector(connectorId: string): Promise<{success:boolean;assetsFound:number;assetsCreated:number;assetsUpdated:number;error?:string}> {
  const {data:row,error:cErr} = await adminClient.from("connectors").select("*").eq("id",connectorId).single();
  if (cErr||!row) return {success:false,assetsFound:0,assetsCreated:0,assetsUpdated:0,error:"Not found"};
  const connector = row as unknown as Connector;
  if (!connector.enabled||connector.status==="disconnected")
    return {success:false,assetsFound:0,assetsCreated:0,assetsUpdated:0,error:"Disabled"};
  const {data:syncRecord} = await adminClient.from("connector_syncs")
    .insert({connector_id:connectorId,org_id:connector.org_id,status:"running"}).select("id").single();
  const syncId = syncRecord?.id as string|undefined;
  await adminClient.from("connectors").update({status:"active"}).eq("id",connectorId);
  let assetsCreated=0, assetsUpdated=0;
  try {
    let creds: Record<string, string>;
    try {
      creds = connector.credentials_encrypted
        ? decryptCredentials(connector.credentials_encrypted)
        : ({} as Record<string, string>);
    } catch (decryptErr) {
      // Encryption key rotation or corruption — surface a specific error
      // rather than letting an opaque crash happen deep in the connector.
      logger.error(
        { connectorId, err: decryptErr },
        "decrypt failed — ENCRYPTION_KEY may have been rotated",
      );
      throw new Error(
        "Stored credentials could not be decrypted. Please re-enter them.",
      );
    }
    const impl = getConnector(connector.kind);
    const hrEmployees = await getHREmployees(connector.org_id);
    const syncResult = await impl.sync(connector, {...creds,...(connector.config as Record<string,string>??{})});

    // Truncate oversized result sets. Keeps the remainder of the pipeline
    // bounded on 10k+ asset orgs.
    let truncated = 0;
    let assets = syncResult.assets;
    if (assets.length > MAX_ASSETS_PER_SYNC) {
      truncated = assets.length - MAX_ASSETS_PER_SYNC;
      assets = assets.slice(0, MAX_ASSETS_PER_SYNC);
      logger.warn(
        { connectorId, total: syncResult.assets.length, kept: MAX_ASSETS_PER_SYNC, truncated },
        "sync: asset count exceeded ceiling — truncating",
      );
    }

    // Plan entitlement: stop persisting before we blow past the org's
    // asset cap. Without this, a starter on a 50-asset plan could end
    // up with 2,000 rows from a single sync and the billing UI would
    // read 50/50 while the DB holds 2,000. Enterprise is uncapped.
    const { data: orgRow } = await adminClient
      .from("organizations")
      .select("*")
      .eq("id", connector.org_id)
      .single();
    const org = orgRow as unknown as Organization | null;
    if (org) {
      const limits = getPlanLimits(org);
      if (limits.maxAssets !== -1) {
        const currentCount = await getOrgAssetCount(org.id);
        const headroom = Math.max(0, limits.maxAssets - currentCount);
        if (headroom === 0) {
          logger.warn(
            { connectorId, orgId: org.id, plan: org.plan, limit: limits.maxAssets },
            "sync: asset plan limit reached — skipping all new assets",
          );
          // Surface on the connector so the operator sees why syncing
          // isn't producing new rows.
          await emitEvent({
            orgId: org.id,
            kind: "connector_sync_completed",
            severity: "high",
            title: `${connector.name} sync skipped — plan limit reached`,
            body: `Your ${org.plan} plan allows a maximum of ${limits.maxAssets} assets. Upgrade to import more.`,
            connectorId,
            metadata: {
              assetsFound: syncResult.assets.length,
              planLimit: limits.maxAssets,
              currentCount,
            },
          });
          assets = [];
        } else if (assets.length > headroom) {
          const skipped = assets.length - headroom;
          assets = assets.slice(0, headroom);
          truncated += skipped;
          logger.warn(
            {
              connectorId,
              orgId: org.id,
              plan: org.plan,
              limit: limits.maxAssets,
              headroom,
              skipped,
            },
            "sync: asset plan limit reached — truncating to fit",
          );
        }
      }
    }

    const newIds: string[] = [];
    for (const na of assets) {
      const r = await upsertAsset(connector, na, hrEmployees);
      if (r.created) { assetsCreated++; newIds.push(r.id); } else assetsUpdated++;
      await scoreAndUpdate(r.id, connector.org_id);
    }
    if (newIds.length) {
      await runPoliciesForOrg(connector.org_id, newIds).catch((e:unknown)=>logger.error({e},"policy engine error"));
    }
    await autoMapCompliance(connector.org_id).catch((e:unknown)=>logger.error({e},"compliance auto-map error"));
    const processed = assets.length;
    const body = truncated > 0
      ? `Found ${syncResult.assets.length} AI assets. Processed the first ${processed} — raise your plan limit to scan the rest.`
      : `Found ${processed} AI assets.`;
    await emitEvent({orgId:connector.org_id,kind:"connector_sync_completed",severity:"info",
      title:connector.name + " sync completed",body,
      connectorId,metadata:{assetsFound:syncResult.assets.length,assetsProcessed:processed,truncated,assetsCreated,assetsUpdated}});
    if (syncId) {
      await adminClient.from("connector_syncs").update({
        status:"completed",completed_at:new Date().toISOString(),
        assets_found:syncResult.assets.length,assets_created:assetsCreated,assets_updated:assetsUpdated,
      }).eq("id",syncId);
    }
    await adminClient.from("connectors").update({
      last_sync_at:new Date().toISOString(),last_sync_status:"completed",
      last_sync_error:null,last_sync_asset_count:processed,
    }).eq("id",connectorId);
    return {success:true,assetsFound:syncResult.assets.length,assetsCreated,assetsUpdated};
  } catch (err:unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({connectorId,error:msg},"sync failed");
    if (syncId) await adminClient.from("connector_syncs").update({status:"failed",completed_at:new Date().toISOString(),error:msg}).eq("id",syncId);
    await adminClient.from("connectors").update({last_sync_at:new Date().toISOString(),last_sync_status:"failed",last_sync_error:msg,status:"error"}).eq("id",connectorId);
    return {success:false,assetsFound:0,assetsCreated:0,assetsUpdated:0,error:msg};
  }
}

async function upsertAsset(connector: Connector, na: NormalizedAsset, hrEmployees: HREmployee[]): Promise<{id:string;created:boolean}> {
  const {data:existing} = await adminClient.from("assets")
    .select("id,owner_email,owner_status,last_seen_at")
    .eq("org_id",connector.org_id).eq("connector_id",connector.id).eq("external_id",na.externalId).single();
  const ownership = resolveOwnership(na, existing?.owner_email??null, hrEmployees);
  const ownerStatus = shouldMarkOrphaned({
    owner_status: ownership.ownerStatus,
    last_changed_at: existing?.last_seen_at??new Date().toISOString(),
    environment: na.environment,
  }) ? "orphaned" as const : ownership.ownerStatus;
  const assetData = {
    org_id:connector.org_id,connector_id:connector.id,external_id:na.externalId,
    name:na.name,description:na.description??null,kind:na.kind,
    source:connector.kind,source_url:na.sourceUrl??null,environment:na.environment,
    owner_email:ownership.ownerEmail,owner_status:ownerStatus,
    owner_confidence:ownership.ownerConfidence,owner_source:ownership.ownerSource,
    ai_services:na.aiServices,data_classification:na.dataClassification,
    tags:na.tags,last_seen_at:new Date().toISOString(),raw_metadata:na.rawMetadata,
  };
  if (existing) {
    await adminClient.from("assets").update({...assetData,last_changed_at:new Date().toISOString()}).eq("id",existing.id);
    if (ownerStatus==="orphaned"&&existing.owner_status!=="orphaned") {
      await emitEvent({orgId:connector.org_id,kind:"owner_orphaned",severity:"high",
        title:"AI asset orphaned: " + na.name,body:"Owner departed.",assetId:existing.id});
    }
    return {id:existing.id,created:false};
  }
  const {data:created} = await adminClient.from("assets")
    .insert({...assetData,first_seen_at:new Date().toISOString()}).select("id").single();
  const newId = created?.id as string;
  await emitEvent({orgId:connector.org_id,kind:"asset_discovered",severity:"info",
    title:"New AI asset: " + na.name,assetId:newId,connectorId:connector.id});
  return {id:newId,created:true};
}

async function scoreAndUpdate(assetId: string, orgId: string): Promise<void> {
  const {data} = await adminClient.from("assets").select("*").eq("id",assetId).single();
  if (!data) return;
  const asset = data as unknown as Asset;
  const {count:vc} = await adminClient.from("policy_violations")
    .select("*",{count:"exact",head:true}).eq("asset_id",assetId).eq("status","open");
  const ctx = buildRiskContext(asset,{openViolationCount:vc??0});
  const {score,level,breakdown} = scoreAsset(asset,ctx);
  await adminClient.from("assets").update({risk_score:score,risk_level:level,risk_breakdown:breakdown,risk_scored_at:new Date().toISOString()}).eq("id",assetId);
  await adminClient.from("risk_history").insert({asset_id:assetId,org_id:orgId,risk_score:score,risk_level:level,risk_breakdown:breakdown});
}

async function getHREmployees(orgId: string): Promise<HREmployee[]> {
  const {data:rows} = await adminClient.from("connectors").select("*").eq("org_id",orgId).in("kind",["rippling","bamboohr","workday"]).eq("status","active");
  if (!rows?.length) return [];
  const all: HREmployee[] = [];
  for (const row of rows) {
    const c = row as unknown as Connector;
    try {
      const impl = getConnector(c.kind);
      if (isHRConnector(impl)) {
        const creds = decryptCredentials(c.credentials_encrypted);
        // Merge config so fields like subdomain/region stored in config
        // also reach the validator, mirroring the main sync path.
        const merged = { ...creds, ...((c.config as Record<string, string>) ?? {}) };
        const {employees} = await impl.fetchEmployees(merged);
        all.push(...employees);
      }
    } catch(e:unknown){ logger.error({connectorId:c.id,e},"HR sync failed"); }
  }
  return all;
}

export async function scheduleOrgSyncs(orgId?: string): Promise<number> {
  let q = adminClient
    .from("connectors")
    .select("id,org_id,last_sync_at,sync_schedule")
    .eq("enabled", true)
    .neq("status", "disconnected");
  if (orgId) q = q.eq("org_id", orgId);
  const { data: connectors } = await q;
  if (!connectors?.length) return 0;

  const now = Date.now();
  let queued = 0;
  for (const c of connectors) {
    const intervalMs = cronToIntervalMs(c.sync_schedule);
    const last = c.last_sync_at ? new Date(c.last_sync_at).getTime() : 0;
    if (now - last >= intervalMs) {
      syncConnector(c.id).catch((e: unknown) =>
        logger.error({ connectorId: c.id, e }, "bg sync failed"),
      );
      queued++;
    }
  }
  return queued;
}

export async function syncAllDueConnectors(): Promise<void> { await scheduleOrgSyncs(); }
