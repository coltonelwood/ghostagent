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
  score(a: Asset, ctx: RiskContext): { score: number; explanation: string };
}

const APPROVED = new Set(["openai","anthropic","google","azure","aws","cohere","mistral"]);
const SENSITIVE = new Set(["openai","anthropic","google","azure-openai","bedrock","vertex-ai","together-ai","groq","huggingface"]);

const DIMS: Dim[] = [
  { name: "ownership_health", weight: 0.25, score(a) {
    switch(a.owner_status) {
      case "orphaned": return {score:25,explanation:"No active owner — orphaned"};
      case "inactive_owner": return {score:18,explanation:"Owner no longer active"};
      case "reassignment_pending": return {score:12,explanation:"Ownership reassignment pending"};
      case "unknown_owner": return {score:10,explanation:"Owner not determined"};
      case "reviewed_unassigned": return {score:5,explanation:"Explicitly unassigned"};
      default: return {score:0,explanation:"Active owner"};
    }
  }},
  { name: "staleness", weight: 0.12, score(_,ctx) {
    const d=ctx.daysSinceLastSeen;
    if(d>365) return {score:12,explanation:`Not seen in ${d} days (>1yr)`};
    if(d>180) return {score:10,explanation:`Not seen in ${d} days (>6mo)`};
    if(d>90) return {score:7,explanation:`Not seen in ${d} days (>3mo)`};
    if(d>30) return {score:4,explanation:`Not seen in ${d} days`};
    return {score:0,explanation:"Recently active"};
  }},
  { name: "data_sensitivity", weight: 0.15, score(a) {
    const dc=a.data_classification??[];
    if(dc.includes("phi")) return {score:15,explanation:"Handles PHI"};
    if(dc.includes("pii")) return {score:12,explanation:"Handles PII"};
    if(dc.includes("financial")) return {score:10,explanation:"Handles financial data"};
    if(dc.includes("internal")) return {score:5,explanation:"Internal data"};
    return {score:5,explanation:"Classification unspecified"};
  }},
  { name: "external_exposure", weight: 0.12, score(a) {
    const svcs=(a.ai_services??[]).map(s=>s.provider.toLowerCase());
    const unap=svcs.filter(s=>!APPROVED.has(s)&&s!=="");
    if(unap.length>0) return {score:12,explanation:`Unapproved providers: ${unap.join(", ")}`};
    if(svcs.some(s=>SENSITIVE.has(s))) return {score:4,explanation:"Approved external providers"};
    return {score:0,explanation:"No external AI providers"};
  }},
  { name: "privileged_access", weight: 0.10, score(a) {
    const scopes=((a.raw_metadata?.scopes as string[])||[]);
    if(scopes.some(s=>s.includes("write")||s.includes("admin")||s.includes("delete"))) return {score:10,explanation:"Write/admin permissions"};
    if(scopes.length>0) return {score:4,explanation:"Read permissions"};
    if(a.environment==="production") return {score:6,explanation:"Production, unverified scope"};
    return {score:0,explanation:"No privileged access detected"};
  }},
  { name: "compliance_gaps", weight: 0.10, score(_,ctx) {
    if(ctx.complianceGapCount===0) return {score:0,explanation:"No compliance gaps"};
    if(ctx.complianceGapCount>=5) return {score:10,explanation:`${ctx.complianceGapCount} compliance gaps`};
    if(ctx.complianceGapCount>=2) return {score:6,explanation:`${ctx.complianceGapCount} gaps`};
    return {score:3,explanation:"1 compliance gap"};
  }},
  { name: "unreviewed_changes", weight: 0.08, score(_,ctx) {
    const d=ctx.daysSinceReview;
    if(!isFinite(d)) return {score:8,explanation:"Never reviewed"};
    if(d>180) return {score:6,explanation:`Last reviewed ${d}d ago`};
    if(d>90) return {score:4,explanation:`Last reviewed ${d}d ago`};
    return {score:0,explanation:`Reviewed ${d}d ago`};
  }},
  { name: "environment_risk", weight: 0.05, score(a) {
    if(a.environment==="production") return {score:5,explanation:"Production environment"};
    if(a.environment==="staging") return {score:2,explanation:"Staging environment"};
    return {score:0,explanation:"Non-production"};
  }},
  { name: "provider_risk", weight: 0.03, score(a) {
    const svcs=(a.ai_services??[]).map(s=>s.provider.toLowerCase());
    if(svcs.length===0) return {score:2,explanation:"No providers identified"};
    if(svcs.some(s=>s.includes("deprecated")||s==="unknown")) return {score:3,explanation:"Deprecated provider"};
    return {score:0,explanation:"Known active providers"};
  }},
  { name: "policy_violations", weight: 0.05, score(_,ctx) {
    if(ctx.openViolationCount===0) return {score:0,explanation:"No violations"};
    if(ctx.openViolationCount>=3) return {score:5,explanation:`${ctx.openViolationCount} violations`};
    return {score:2,explanation:"1-2 violations"};
  }},
];

function toLevel(n: number): RiskLevel {
  if(n>=76) return "critical";
  if(n>=51) return "high";
  if(n>=26) return "medium";
  return "low";
}

export function scoreAsset(asset: Asset, ctx: RiskContext): RiskScore {
  const breakdown: Record<string,RiskDimensionBreakdown>={};
  let total=0;
  for(const d of DIMS) {
    const {score:raw,explanation}=d.score(asset,ctx);
    const clamped=Math.max(0,Math.min(100,raw));
    breakdown[d.name]={score:clamped,weight:d.weight,explanation};
    total+=clamped*d.weight;
  }
  const final=Math.max(0,Math.min(100,Math.round(total)));
  return {score:final,level:toLevel(final),breakdown};
}

export function buildRiskContext(
  asset: Asset,
  opts: {ownerActiveInHR?:boolean|null;openViolationCount?:number;complianceGapCount?:number}={}
): RiskContext {
  const now=Date.now();
  const daysSinceLastSeen=Math.floor((now-new Date(asset.last_seen_at).getTime())/86400000);
  const daysSinceReview=asset.reviewed_at
    ? Math.floor((now-new Date(asset.reviewed_at).getTime())/86400000)
    : Infinity;
  return {
    ownerActiveInHR:opts.ownerActiveInHR??null,
    daysSinceLastSeen,
    daysSinceReview,
    openViolationCount:opts.openViolationCount??0,
    complianceGapCount:opts.complianceGapCount??0,
  };
}
