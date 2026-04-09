import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireRole, AuthError } from "@/lib/org-auth";
import { auditLog } from "@/lib/audit";
import { emitEvent } from "@/lib/event-system";
import { decrypt } from "@/lib/crypto";
import { getConnector } from "@/lib/connectors";
import { apiRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export const POST = withLogging(
  async (req: NextRequest, ctx: unknown) => {
    try {
      const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
      const auth = await requireRole("admin");

      const rl = apiRateLimiter.check(auth.userId);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
        );
      }

      const db = getAdminClient();
      const { data: asset } = await db
        .from("assets")
        .select("*")
        .eq("id", id)
        .eq("org_id", auth.orgId)
        .single();

      if (!asset) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      if (asset.status === "quarantined") {
        return NextResponse.json(
          { error: "Asset is already quarantined" },
          { status: 400 },
        );
      }

      const now = new Date().toISOString();

      // Update asset status
      const { data: updated, error } = await db
        .from("assets")
        .update({
          status: "quarantined",
          last_changed_at: now,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Try to quarantine via connector if available
      let connectorResult: { success: boolean; error?: string } | null = null;
      if (asset.connector_id && asset.external_id) {
        try {
          const { data: connector } = await db
            .from("connectors")
            .select("kind, credentials_encrypted")
            .eq("id", asset.connector_id)
            .single();

          if (connector) {
            const impl = getConnector(connector.kind as never);
            if (impl.quarantine) {
              const credentials = JSON.parse(
                decrypt(connector.credentials_encrypted),
              );
              connectorResult = await impl.quarantine(
                { id: asset.connector_id } as never,
                credentials,
                asset.external_id,
              );
            }
          }
        } catch {
          // Non-fatal: asset is still quarantined in DB
          connectorResult = {
            success: false,
            error: "Connector quarantine call failed",
          };
        }
      }

      // Emit event
      await emitEvent({
        orgId: auth.orgId,
        kind: "asset_quarantined",
        severity: "high",
        title: `Asset quarantined: ${asset.name}`,
        metadata: {
          previousStatus: asset.status,
          connectorQuarantine: connectorResult,
        },
        assetId: id,
        actorId: auth.userId,
      });

      // Create history entry
      await db.from("asset_history").insert({
        asset_id: id,
        org_id: auth.orgId,
        changed_by: auth.userId,
        change_type: "quarantined",
        previous_state: { status: asset.status },
        new_state: { status: "quarantined" },
      });

      await auditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        actorEmail: auth.email,
        action: "asset.quarantined",
        resourceType: "asset",
        resourceId: id,
        metadata: { connectorResult },
        req,
      });

      return NextResponse.json({
        data: updated,
        connectorResult,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  },
);
