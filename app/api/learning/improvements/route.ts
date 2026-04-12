import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { authorizeLearningRequest } from "@/lib/learning/guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/learning/improvements
 *
 * List proposed improvements for review. Never auto-applies — apply
 * happens via PATCH on the individual improvement.
 */
export async function GET(req: NextRequest) {
  const auth = await authorizeLearningRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "proposed";
  const limit = Math.min(
    200,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "100", 10) || 100),
  );

  const { data, error } = await adminClient
    .from("learning_improvements")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
