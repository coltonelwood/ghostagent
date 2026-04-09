import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth, AuthError } from "@/lib/org-auth";
import { apiRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export const GET = withLogging(async (req: NextRequest) => {
  try {
    const auth = await requireAuth();

    const rl = apiRateLimiter.check(auth.userId);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
      );
    }

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")),
    );
    const offset = (page - 1) * limit;

    const source = url.searchParams.get("source");
    const riskLevel = url.searchParams.get("risk_level");
    const ownerStatus = url.searchParams.get("owner_status");
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search");
    const kind = url.searchParams.get("kind");
    const environment = url.searchParams.get("environment");
    const sortBy = url.searchParams.get("sort") ?? "risk_score";
    const sortDir = url.searchParams.get("dir") ?? "desc";

    const db = getAdminClient();
    let query = db
      .from("assets")
      .select("*", { count: "exact" })
      .eq("org_id", auth.orgId)
      .range(offset, offset + limit - 1);

    if (source) query = query.eq("source", source);
    if (riskLevel) query = query.eq("risk_level", riskLevel);
    if (ownerStatus) query = query.eq("owner_status", ownerStatus);
    if (status) query = query.eq("status", status);
    if (kind) query = query.eq("kind", kind);
    if (environment) query = query.eq("environment", environment);
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,description.ilike.%${search}%`,
      );
    }

    const validSorts = [
      "risk_score",
      "name",
      "created_at",
      "last_seen_at",
      "owner_status",
      "risk_level",
    ];
    const safeSort = validSorts.includes(sortBy) ? sortBy : "risk_score";
    query = query.order(safeSort, { ascending: sortDir === "asc" });

    const { data, count, error } = await query;
    if (error) throw error;

    const total = count ?? 0;

    return NextResponse.json({
      data: data ?? [],
      total,
      page,
      hasMore: offset + limit < total,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});
