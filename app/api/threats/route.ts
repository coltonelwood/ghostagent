import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { requireAuth, requireRole, AuthError } from "@/lib/org-auth";
import { apiRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";
import {
  listFingerprints,
  extractBehavioralFingerprint,
} from "@/lib/threat-intelligence";

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
    const type = params.get("type") ?? undefined;
    const status = params.get("status") ?? undefined;
    const limit = params.get("limit") ? Number(params.get("limit")) : undefined;
    const offset = params.get("offset") ? Number(params.get("offset")) : undefined;

    const result = await listFingerprints(auth.orgId, {
      type,
      status,
      limit,
      offset,
    });

    return NextResponse.json({ data: result.data, total: result.total });
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

    let body: {
      type: string;
      indicators: string[];
      timeline: string;
      narrative: string;
      affected_asset_ids?: string[];
      severity?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be JSON." },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 },
      );
    }
    if (!body.type || typeof body.type !== "string") {
      return NextResponse.json(
        { error: "A threat type is required." },
        { status: 400 },
      );
    }
    if (!Array.isArray(body.indicators) || body.indicators.length === 0) {
      return NextResponse.json(
        { error: "At least one indicator is required." },
        { status: 400 },
      );
    }
    if (!body.timeline || typeof body.timeline !== "string") {
      return NextResponse.json(
        { error: "A timeline description is required." },
        { status: 400 },
      );
    }
    if (!body.narrative || typeof body.narrative !== "string") {
      return NextResponse.json(
        { error: "A narrative description is required." },
        { status: 400 },
      );
    }

    const result = await extractBehavioralFingerprint(auth.orgId, {
      type: body.type as any,
      indicators: body.indicators,
      timeline: body.timeline,
      narrative: body.narrative,
      affected_assets: body.affected_asset_ids,
      severity: body.severity as any,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});
