import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scanId = req.nextUrl.searchParams.get("id");
  if (!scanId) {
    return NextResponse.json({ error: "Missing scan id" }, { status: 400 });
  }

  // Basic UUID format check — prevents injection
  if (!/^[0-9a-f-]{36}$/.test(scanId)) {
    return NextResponse.json({ error: "Invalid scan id" }, { status: 400 });
  }

  const { data: scan, error } = await supabase
    .from("scans")
    .select("id, workspace_id, status, repos_scanned, agents_found, error_message, started_at, completed_at")
    .eq("id", scanId)
    .single();

  if (error || !scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  // Ownership verified: Supabase RLS ensures scan belongs to user's workspace

  const response = NextResponse.json({ scan });

  // Cache completed/failed scans for 30 seconds — no need to re-query
  if (scan.status === "completed" || scan.status === "failed") {
    response.headers.set("Cache-Control", "public, max-age=30, s-maxage=30");
  } else {
    // Active scans: no cache (client needs fresh data)
    response.headers.set("Cache-Control", "no-store");
  }

  return response;
}
