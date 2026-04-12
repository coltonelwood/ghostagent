import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { requireRole, AuthError } from "@/lib/org-auth";
import { apiRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";
import { shareToNetwork } from "@/lib/threat-intelligence";

export const dynamic = "force-dynamic";

export const POST = withLogging(
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

      const result = await shareToNetwork(auth.orgId, id);

      return NextResponse.json({ data: result }, { status: 201 });
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  },
);
