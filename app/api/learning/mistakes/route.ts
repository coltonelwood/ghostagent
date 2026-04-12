import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { authorizeLearningRequest } from "@/lib/learning/guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/learning/mistakes
 *
 * Query params:
 *   - status: open | reviewed | fix_proposed | fixed | dismissed (default: open)
 *   - severity: low | medium | high | critical
 *   - limit: default 100, max 500
 */
export async function GET(req: NextRequest) {
  const auth = await authorizeLearningRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "open";
  const severity = url.searchParams.get("severity");
  const limit = Math.min(
    500,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "100", 10) || 100),
  );

  let query = adminClient
    .from("learning_mistakes")
    .select("*, learning_projects(label)")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (severity) {
    query = query.eq("severity", severity);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
