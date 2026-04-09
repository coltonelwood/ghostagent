import { getAdminClient } from "@/lib/supabase/admin";
import logger from "@/lib/logger";

const auditLogger = logger.child({ module: "audit" });

export async function auditLog(params: {
  orgId: string;
  actorId?: string;
  actorEmail?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}): Promise<void> {
  const {
    orgId,
    actorId,
    actorEmail,
    action,
    resourceType,
    resourceId,
    metadata = {},
    req,
  } = params;

  let ip_address: string | null = null;
  let user_agent: string | null = null;

  if (req) {
    ip_address =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null;
    user_agent = req.headers.get("user-agent") ?? null;
  }

  try {
    const adminClient = getAdminClient();
    const { error } = await adminClient.from("audit_log").insert({
      org_id: orgId,
      actor_id: actorId ?? null,
      actor_email: actorEmail ?? null,
      action,
      resource_type: resourceType ?? null,
      resource_id: resourceId ?? null,
      metadata,
      ip_address,
      user_agent,
    });

    if (error) {
      auditLogger.error(
        { error, action, orgId },
        "Failed to write audit entry",
      );
    } else {
      auditLogger.info(
        { action, orgId, actorId, resourceType, resourceId },
        "Audit event recorded",
      );
    }
  } catch (err) {
    auditLogger.error(
      { err, action, orgId },
      "Unexpected error writing audit entry",
    );
  }
}
