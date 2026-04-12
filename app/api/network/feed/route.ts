import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { requireAuth, AuthError } from "@/lib/org-auth";
import { apiRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";
import { receiveFromNetwork } from "@/lib/threat-intelligence";

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

    const params = req.nextUrl.searchParams;
    const limit = params.get("limit") ? Number(params.get("limit")) : undefined;
    const offset = params.get("offset") ? Number(params.get("offset")) : undefined;
    const since = params.get("since") ?? undefined;

    const result = await receiveFromNetwork(auth.orgId, {
      limit,
      offset,
      since,
    });

    return NextResponse.json({ data: result.data, total: result.total });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});
