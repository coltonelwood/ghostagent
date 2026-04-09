import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Health check endpoint for uptime monitoring (UptimeRobot, BetterStack, etc.)
 * GET /api/health → 200 OK with system status
 */
export async function GET() {
  const checks: Record<string, "ok" | "error"> = {
    api: "ok",
    database: "error",
  };

  // Check DB connectivity
  try {
    // Check both legacy and platform tables
    const { error } = await adminClient
      .from("organizations")
      .select("id")
      .limit(1)
      .maybeSingle();

    checks.database = error ? "error" : "ok";
  } catch {
    checks.database = "error";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");
  const status = allOk ? 200 : 503;

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "0.1.0",
    },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
