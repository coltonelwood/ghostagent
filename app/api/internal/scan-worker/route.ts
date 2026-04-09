import { NextRequest, NextResponse } from "next/server";
import { runScan } from "@/lib/scanner";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-internal-key");
  if (key !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { scanId, workspaceId } = await req.json();

  if (!scanId || !workspaceId) {
    return NextResponse.json({ error: "Missing scanId or workspaceId" }, { status: 400 });
  }

  // Fire and forget — don't await, return immediately
  runScan(scanId, workspaceId).catch(console.error);

  return NextResponse.json({ started: true });
}
