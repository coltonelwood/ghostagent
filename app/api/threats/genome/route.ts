import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { requireAuth, requireRole, AuthError } from "@/lib/org-auth";
import { apiRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";
import { getLatestGenome, computeGenome } from "@/lib/threat-intelligence";

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

    const genome = await getLatestGenome(auth.orgId);
    if (!genome) {
      return NextResponse.json({ error: "No genome found. Compute one first." }, { status: 404 });
    }

    return NextResponse.json({ data: genome });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});

export const POST = withLogging(async (req: NextRequest) => {
  try {
    const auth = await requireRole("operator");

    const rl = apiRateLimiter.check(auth.userId);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
      );
    }

    const result = await computeGenome(auth.orgId);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});
