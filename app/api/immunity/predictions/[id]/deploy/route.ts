import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { requireRole, AuthError } from "@/lib/org-auth";
import { apiRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";
import { deployCountermeasure } from "@/lib/threat-intelligence";

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

      let body: {
        auto_deploy?: boolean;
        countermeasure_type?: string;
      };
      try {
        body = await req.json();
      } catch {
        body = {};
      }

      const result = await deployCountermeasure(auth.orgId, id, {
        auto: body.auto_deploy,
        countermeasure_type: body.countermeasure_type as any,
      });

      return NextResponse.json({ data: result }, { status: 201 });
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  },
);
