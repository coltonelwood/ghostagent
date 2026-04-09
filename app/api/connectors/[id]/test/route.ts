import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireRole, AuthError } from "@/lib/org-auth";
import { getConnector } from "@/lib/connectors";
import { apiRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export const POST = withLogging(
  async (req: NextRequest, ctx: unknown) => {
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

      const db = getAdminClient();
      const { data: connector } = await db
        .from("connectors")
        .select("id, org_id, kind")
        .eq("id", id)
        .eq("org_id", auth.orgId)
        .single();

      if (!connector) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const body = (await req.json()) as {
        credentials: Record<string, string>;
      };
      if (!body.credentials) {
        return NextResponse.json(
          { error: "credentials required" },
          { status: 400 },
        );
      }

      const impl = getConnector(connector.kind as never);
      const result = await impl.validate(body.credentials);

      return NextResponse.json({ data: result });
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  },
);
