import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { requireAuth, requireRole, AuthError } from "@/lib/org-auth";
import { apiRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";
import {
  getMembership,
  joinNetwork,
  updateMembership,
  withdrawFromNetwork,
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

    const membership = await getMembership(auth.orgId);
    if (!membership) {
      return NextResponse.json({ error: "Not a network member" }, { status: 404 });
    }

    return NextResponse.json({ data: membership });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});

export const POST = withLogging(async (req: NextRequest) => {
  try {
    const auth = await requireRole("owner");

    const rl = apiRateLimiter.check(auth.userId);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
      );
    }

    let body: {
      contribution_tier?: string;
      share_threat_fingerprints?: boolean;
      share_genome_profile?: boolean;
      anonymization_level?: string;
    };
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const result = await joinNetwork(auth.orgId, body);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});

export const PATCH = withLogging(async (req: NextRequest) => {
  try {
    const auth = await requireRole("admin");

    const rl = apiRateLimiter.check(auth.userId);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
      );
    }

    let body: {
      contribution_tier?: string;
      share_threat_fingerprints?: boolean;
      share_genome_profile?: boolean;
      share_countermeasure_outcomes?: boolean;
      anonymization_level?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be JSON." },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object" || Object.keys(body).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update." },
        { status: 400 },
      );
    }

    const result = await updateMembership(auth.orgId, body);

    return NextResponse.json({ data: result });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});

export const DELETE = withLogging(async (req: NextRequest) => {
  try {
    const auth = await requireRole("owner");

    const rl = apiRateLimiter.check(auth.userId);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
      );
    }

    await withdrawFromNetwork(auth.orgId);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});
