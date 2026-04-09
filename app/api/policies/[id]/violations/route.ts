import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth, AuthError } from "@/lib/org-auth";
import { apiRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export const GET = withLogging(
  async (req: NextRequest, ctx: unknown) => {
    try {
      const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
      const auth = await requireAuth();

      const rl = apiRateLimiter.check(auth.userId);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
        );
      }

      const url = new URL(req.url);
      const status = url.searchParams.get("status");
      const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
      const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "25")));

      const db = getAdminClient();

      // Verify policy belongs to org
      const { data: policy } = await db
        .from("policies")
        .select("id")
        .eq("id", id)
        .eq("org_id", auth.orgId)
        .single();

      if (!policy) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      let query = db
        .from("policy_violations")
        .select("*, assets(id, name, source, risk_level, owner_email)", { count: "exact" })
        .eq("policy_id", id)
        .eq("org_id", auth.orgId);

      if (status) {
        query = query.eq("status", status);
      }

      query = query
        .order("last_detected_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      const { data: violations, count, error } = await query;

      if (error) throw error;

      return NextResponse.json({
        data: violations ?? [],
        total: count ?? 0,
        page,
        pageSize,
        hasMore: (count ?? 0) > page * pageSize,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  },
);
