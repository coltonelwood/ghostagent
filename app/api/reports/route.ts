import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireRole, requireAuth, AuthError } from "@/lib/org-auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/reports
 *
 * Returns report generation timestamps for the current org.
 * Stored in organizations.settings.report_timestamps.
 */
export const GET = withLogging(async () => {
  try {
    const auth = await requireAuth();
    const db = getAdminClient();

    const { data: org } = await db
      .from("organizations")
      .select("settings")
      .eq("id", auth.orgId)
      .single();

    const settings = (org?.settings ?? {}) as Record<string, unknown>;
    const timestamps = (settings.report_timestamps ?? {}) as Record<string, string>;

    return NextResponse.json({ data: timestamps });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});

/**
 * POST /api/reports
 *
 * Records that a report was generated. Stores the timestamp in
 * organizations.settings.report_timestamps keyed by report_type.
 *
 * Body: { report_type: string }
 */
export const POST = withLogging(async (req: NextRequest) => {
  try {
    const auth = await requireRole("viewer");
    const db = getAdminClient();

    const body = (await req.json()) as { report_type: string };
    const { report_type } = body;

    if (!report_type || typeof report_type !== "string") {
      return NextResponse.json(
        { error: "report_type is required" },
        { status: 400 },
      );
    }

    // Fetch current settings
    const { data: org } = await db
      .from("organizations")
      .select("settings")
      .eq("id", auth.orgId)
      .single();

    const settings = (org?.settings ?? {}) as Record<string, unknown>;
    const timestamps = ((settings.report_timestamps ?? {}) as Record<string, unknown>);
    const now = new Date().toISOString();

    timestamps[report_type] = {
      generated_at: now,
      generated_by: auth.email,
    };

    const updatedSettings = { ...settings, report_timestamps: timestamps };

    const { error } = await db
      .from("organizations")
      .update({ settings: updatedSettings, updated_at: now })
      .eq("id", auth.orgId);

    if (error) {
      logger.error({ error }, "POST /api/reports: failed to save timestamp");
      return NextResponse.json(
        { error: "Failed to save report metadata" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: {
        report_type,
        generated_at: now,
        generated_by: auth.email,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});
