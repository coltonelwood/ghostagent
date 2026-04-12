import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import { getOrCreateOrgForUser, requireOrgMember } from "@/lib/org";
import { withLogging } from "@/lib/api-handler";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const GET = withLogging(async () => {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOrCreateOrgForUser(user.id, user.email!);
  await requireOrgMember(user.id, org.id, "viewer");

  const db = getAdminClient();

  // Run all analytics queries in parallel
  const [
    assetsRes,
    violationsRes,
    connectorsRes,
    eventsRes,
    frameworksRes,
    topRiskRes,
  ] = await Promise.all([
    db.from("assets").select("id, kind, risk_level, owner_status, source, status, environment, data_classification").eq("org_id", org.id),
    db.from("policy_violations").select("severity, status").eq("org_id", org.id).eq("status", "open"),
    db.from("connectors").select("id, status, kind, last_sync_at").eq("org_id", org.id).neq("status", "disconnected"),
    db.from("events").select("id, kind, severity, title, created_at, asset_id").eq("org_id", org.id).order("created_at", { ascending: false }).limit(10),
    db.from("compliance_frameworks").select("id, code, enabled").eq("enabled", true),
    db.from("assets").select("id, name, kind, risk_level, risk_score, owner_email, owner_status, source, environment, description").eq("org_id", org.id).eq("status", "active").order("risk_score", { ascending: false }).limit(5),
  ]);

  const assets = assetsRes.data ?? [];
  const violations = violationsRes.data ?? [];
  const connectors = connectorsRes.data ?? [];

  // Compute distributions
  const totalAssets = assets.filter((a) => a.status === "active").length;

  const assetsByKind: Record<string, number> = {};
  const assetsBySource: Record<string, number> = {};
  const assetsByRiskLevel: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };

  let orphanedAssets = 0;
  let criticalAssets = 0;
  let sensitiveDataAssets = 0;
  const sensitiveLabels = new Set(["pii", "phi", "financial"]);

  for (const a of assets) {
    if (a.status !== "active") continue;
    if (a.kind) assetsByKind[a.kind] = (assetsByKind[a.kind] ?? 0) + 1;
    if (a.source) assetsBySource[a.source] = (assetsBySource[a.source] ?? 0) + 1;
    if (a.risk_level) assetsByRiskLevel[a.risk_level] = (assetsByRiskLevel[a.risk_level] ?? 0) + 1;
    if (a.owner_status === "orphaned") orphanedAssets++;
    if (a.risk_level === "critical") criticalAssets++;
    const dc = a.data_classification as string[] | null;
    if (dc?.some((c: string) => sensitiveLabels.has(c))) sensitiveDataAssets++;
  }

  const openViolations = violations.length;

  const connectorCount = connectors.length;
  const connectorsByStatus: Record<string, number> = {};
  for (const c of connectors) {
    connectorsByStatus[c.status] = (connectorsByStatus[c.status] ?? 0) + 1;
  }

  // Compliance score (if frameworks enabled)
  let complianceScore: number | null = null;
  const enabledFrameworks = frameworksRes.data ?? [];
  if (enabledFrameworks.length > 0) {
    try {
      const { fullComplianceReport } = await import("@/lib/compliance/report-generator");
      const report = await fullComplianceReport(org.id);
      complianceScore = report.overallScore;
    } catch (err) {
      logger.warn({ err }, "Failed to compute compliance score for analytics");
    }
  }

  return NextResponse.json({
    data: {
      totalAssets,
      assetsByKind,
      assetsBySource,
      assetsByRiskLevel,
      orphanedAssets,
      openViolations,
      criticalAssets,
      connectorCount,
      connectorsByStatus,
      sensitiveDataAssets,
      recentEvents: eventsRes.data ?? [],
      topRiskAssets: topRiskRes.data ?? [],
      complianceScore,
    },
  });
});
