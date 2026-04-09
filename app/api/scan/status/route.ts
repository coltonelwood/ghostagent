import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const { data: scan } = await supabase
    .from("scans")
    .select("*")
    .eq("id", scanId)
    .single();

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  return NextResponse.json({ scan });
}
