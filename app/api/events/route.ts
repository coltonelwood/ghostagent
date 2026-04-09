import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import { getOrCreateOrgForUser, requireOrgMember } from "@/lib/org";
import { withLogging } from "@/lib/api-handler";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

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

  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);
  const offset = (page - 1) * limit;
  const kind = url.searchParams.get("kind");
  const severity = url.searchParams.get("severity");
  const assetId = url.searchParams.get("assetId");
  const connectorId = url.searchParams.get("connectorId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let query = db
    .from("events")
    .select("*, assets(id,name,source,risk_level)", { count: "exact" })
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (kind) query = query.eq("kind", kind);
  if (severity) query = query.eq("severity", severity);
  if (assetId) query = query.eq("asset_id", assetId);
  if (connectorId) query = query.eq("connector_id", connectorId);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, count, error } = await query;
  if (error) {
    logger.error({ error }, "GET /api/events query error");
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    hasMore: (offset + limit) < (count ?? 0),
  });
});
