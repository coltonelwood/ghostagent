import { NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { requireRole, AuthError } from "@/lib/org-auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

/**
 * POST /api/org/regenerate-key
 * Regenerate the org's SDK API key. Requires admin role.
 * The old key is immediately invalidated.
 */
export const POST = withLogging(async (req) => {
  try {
    const auth = await requireRole("admin");
    const db = getAdminClient();

    // Generate new cryptographically random key
    const newKey = `nxs_${randomBytes(32).toString("hex")}`;

    const { data: updated, error } = await db
      .from("organizations")
      .update({ sdk_api_key: newKey, updated_at: new Date().toISOString() })
      .eq("id", auth.orgId)
      .select("id, sdk_api_key")
      .single();

    if (error) throw error;

    await auditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      actorEmail: auth.email,
      action: "org.sdk_key_regenerated",
      resourceType: "organization",
      resourceId: auth.orgId,
      req,
    });

    logger.info({ orgId: auth.orgId, userId: auth.userId }, "SDK API key regenerated");

    return NextResponse.json({ data: { sdk_api_key: updated?.sdk_api_key } });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    logger.error({ err }, "POST /api/org/regenerate-key error");
    return NextResponse.json({ error: "Failed to regenerate key. Please try again." }, { status: 500 });
  }
});
