import { adminClient } from "./supabase/admin";
import { getConnector, isHRConnector } from "./connectors";
import { decrypt } from "./crypto";

function decryptCredentials(encrypted: string): Record<string, string> {
  return JSON.parse(decrypt(encrypted));
}
import { scoreAsset, buildRiskContext } from "./risk-engine";
import { resolveOwnership, shouldMarkOrphaned } from "./ownership-engine";
import { runPoliciesForOrg } from "./policy-engine";
import { emitEvent } from "./event-system";
import { logger } from "./logger";
import type { Asset, Connector, HREmployee, NormalizedAsset } from "./types/platform";

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
    const creds = connector.credentials_encrypted ? decryptCredentials(connector.credentials_encrypted) : {} as Record<string,string>;
    const impl = getConnector(connector.kind);
    const hrEmployees = await getHREmployees(connector.org_id);
    const syncResult = await impl.sync(connector, {...creds,...(connector.config as Record<string,string>??{})});
    const newIds: string[] = [];
    for (const na of syncResult.assets) {
      const r = await upsertAsset(connector, na, hrEmployees);
      if (r.created) { assetsCreated++; newIds.push(r.id); } else assetsUpdated++;
      await scoreAndUpdate(r.id, connector.org_id);
    }
    if (newIds.length) {
      await runPoliciesForOrg(connector.org_id, newIds).catch((e:unknown)=>logger.error({e},"policy engine error"));
    }
    await emitEvent({orgId:connector.org_id,kind:"connector_sync_completed",severity:"info",
      title:connector.name + " sync completed",body:"Found " + syncResult.assets.length + " AI assets.",
      connectorId,metadata:{assetsFound:syncResult.assets.length,assetsCreated,assetsUpdated}});
    if (syncId) {
      await adminClient.from("connector_syncs").update({
        status:"completed",completed_at:new Date().toISOString(),
        assets_found:syncResult.assets.length,assets_created:assetsCreated,assets_updated:assetsUpdated,
      }).eq("id",syncId);
    }
    await adminClient.from("connectors").update({
      last_sync_at:new Date().toISOString(),last_sync_status:"completed",
      last_sync_error:null,last_sync_asset_count:syncResult.assets.length,
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
        const {employees} = await impl.fetchEmployees(creds);
        all.push(...employees);
      }
    } catch(e:unknown){ logger.error({connectorId:c.id,e},"HR sync failed"); }
  }
  return all;
}

export async function scheduleOrgSyncs(orgId?: string): Promise<number> {
  let q = adminClient.from("connectors").select("id,org_id,last_sync_at").eq("enabled",true).neq("status","disconnected");
  if (orgId) q = q.eq("org_id",orgId);
  const {data:connectors} = await q;
  if (!connectors?.length) return 0;
  const sixHAgo = new Date(Date.now()-6*60*60*1000);
  let queued=0;
  for (const c of connectors) {
    const last = c.last_sync_at ? new Date(c.last_sync_at) : null;
    if (!last||last<sixHAgo) {
      syncConnector(c.id).catch((e:unknown)=>logger.error({connectorId:c.id,e},"bg sync failed"));
      queued++;
    }
  }
  return queued;
}

export async function syncAllDueConnectors(): Promise<void> { await scheduleOrgSyncs(); }
