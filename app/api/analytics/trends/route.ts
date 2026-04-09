import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import { getOrCreateOrgForUser, requireOrgMember } from "@/lib/org";
import { withLogging } from "@/lib/api-handler";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function getPeriodDays(period: string): number {
  switch (period) {
    case "7d": return 7;
    case "30d": return 30;
    case "90d": return 90;
    default: return 30;
  }
}

function getDateBuckets(days: number): string[] {
  const buckets: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.push(d.toISOString().split("T")[0]);
  }
  return buckets;
}

export const GET = withLogging(async (req: NextRequest) => {
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
  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? "30d";
  const days = getPeriodDays(period);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const dateBuckets = getDateBuckets(days);

  // Fetch data in parallel
  const [riskHistoryRes, assetsRes, violationsRes] = await Promise.all([
    db.from("risk_history")
      .select("risk_score, risk_level, scored_at")
      .eq("org_id", org.id)
      .gte("scored_at", cutoff)
      .order("scored_at", { ascending: true }),
    db.from("assets")
      .select("id, created_at, risk_level")
      .eq("org_id", org.id)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: true }),
    db.from("policy_violations")
      .select("id, status, first_detected_at, resolved_at")
      .eq("org_id", org.id)
      .or(`first_detected_at.gte.${cutoff},resolved_at.gte.${cutoff}`),
  ]);

  // Risk score distribution over time
  const riskByDate: Record<string, { total: number; count: number }> = {};
  for (const bucket of dateBuckets) {
    riskByDate[bucket] = { total: 0, count: 0 };
  }
  for (const r of riskHistoryRes.data ?? []) {
    const day = r.scored_at?.split("T")[0];
    if (day && riskByDate[day]) {
      riskByDate[day].total += r.risk_score ?? 0;
      riskByDate[day].count += 1;
    }
  }
  const riskTrend = dateBuckets.map((date) => ({
    date,
    value: riskByDate[date].count > 0
      ? Math.round(riskByDate[date].total / riskByDate[date].count)
      : 0,
  }));

  // New assets over time
  const assetsByDate: Record<string, number> = {};
  for (const bucket of dateBuckets) {
    assetsByDate[bucket] = 0;
  }
  for (const a of assetsRes.data ?? []) {
    const day = a.created_at?.split("T")[0];
    if (day && assetsByDate[day] !== undefined) {
      assetsByDate[day]++;
    }
  }
  const assetTrend = dateBuckets.map((date) => ({
    date,
    value: assetsByDate[date],
  }));

  // Violations opened/resolved over time
  const violationsOpened: Record<string, number> = {};
  const violationsResolved: Record<string, number> = {};
  for (const bucket of dateBuckets) {
    violationsOpened[bucket] = 0;
    violationsResolved[bucket] = 0;
  }
  for (const v of violationsRes.data ?? []) {
    const openDay = v.first_detected_at?.split("T")[0];
    if (openDay && violationsOpened[openDay] !== undefined) {
      violationsOpened[openDay]++;
    }
    if (v.resolved_at) {
      const resolveDay = v.resolved_at.split("T")[0];
      if (resolveDay && violationsResolved[resolveDay] !== undefined) {
        violationsResolved[resolveDay]++;
      }
    }
  }
  const violationsOpenedTrend = dateBuckets.map((date) => ({
    date,
    value: violationsOpened[date],
  }));
  const violationsResolvedTrend = dateBuckets.map((date) => ({
    date,
    value: violationsResolved[date],
  }));

  return NextResponse.json({
    data: {
      period,
      riskTrend,
      assetTrend,
      violationsOpenedTrend,
      violationsResolvedTrend,
    },
  });
});
