import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireRole, AuthError } from "@/lib/org-auth";
import { apiRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

async function loadFingerprint(id: string, orgId: string) {
  const db = getAdminClient();
  const { data } = await db
    .from("threat_behavioral_fingerprints")
    .select("*")
    .eq("id", id)
    .eq("reporting_org_id", orgId)
    .single();
  return data;
}

export const GET = withLogging(
  async (_req: NextRequest, ctx: unknown) => {
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

      const fingerprint = await loadFingerprint(id, auth.orgId);
      if (!fingerprint) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      return NextResponse.json({ data: fingerprint });
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  },
);

export const PATCH = withLogging(
  async (req: NextRequest, ctx: unknown) => {
    try {
      const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
      const auth = await requireRole("operator");

      const rl = apiRateLimiter.check(auth.userId);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
        );
      }

      const fingerprint = await loadFingerprint(id, auth.orgId);
      if (!fingerprint) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      let body: { status?: string };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          { error: "Request body must be JSON." },
          { status: 400 },
        );
      }

      const validStatuses = ["active", "confirmed", "superseded", "false_positive"];
      if (!body.status || !validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: `Status must be one of: ${validStatuses.join(", ")}` },
          { status: 400 },
        );
      }

      const db = getAdminClient();
      const { data: updated, error } = await db
        .from("threat_behavioral_fingerprints")
        .update({
          status: body.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("reporting_org_id", auth.orgId)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ data: updated });
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  },
);

export const DELETE = withLogging(
  async (_req: NextRequest, ctx: unknown) => {
    try {
      const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
      const auth = await requireRole("admin");

      const rl = apiRateLimiter.check(auth.userId);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
        );
      }

      const fingerprint = await loadFingerprint(id, auth.orgId);
      if (!fingerprint) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const db = getAdminClient();
      const { error } = await db
        .from("threat_behavioral_fingerprints")
        .delete()
        .eq("id", id)
        .eq("reporting_org_id", auth.orgId);

      if (error) throw error;

      return NextResponse.json({ success: true });
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  },
);
