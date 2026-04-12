import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireRole, AuthError } from "@/lib/org-auth";
import { apiRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";
import { getPrediction, acknowledgePrediction } from "@/lib/threat-intelligence";

export const dynamic = "force-dynamic";

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

      const prediction = await getPrediction(id, auth.orgId);
      if (!prediction) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      return NextResponse.json({ data: prediction });
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

      let body: { action: string };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          { error: "Request body must be JSON." },
          { status: 400 },
        );
      }

      if (!body.action || !["acknowledge", "dismiss"].includes(body.action)) {
        return NextResponse.json(
          { error: "Action must be 'acknowledge' or 'dismiss'." },
          { status: 400 },
        );
      }

      if (body.action === "acknowledge") {
        const result = await acknowledgePrediction(id, auth.orgId);
        if (!result.success) {
          return NextResponse.json(
            { error: "Failed to acknowledge prediction. It may not exist or is already processed." },
            { status: 400 },
          );
        }
        return NextResponse.json({ data: { id, status: "acknowledged" } });
      }

      // Dismiss action
      const db = getAdminClient();
      const { error } = await db
        .from("attack_predictions")
        .update({
          status: "expired",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("target_org_id", auth.orgId);

      if (error) throw error;

      return NextResponse.json({ data: { id, status: "expired" } });
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  },
);
