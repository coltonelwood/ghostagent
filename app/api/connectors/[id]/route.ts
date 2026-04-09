import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireRole, AuthError } from "@/lib/org-auth";
import { encrypt } from "@/lib/crypto";
import { getConnector } from "@/lib/connectors";
import { auditLog } from "@/lib/audit";
import { apiRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

async function loadConnector(id: string, orgId: string) {
  const db = getAdminClient();
  const { data } = await db
    .from("connectors")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();
  return data;
}

export const GET = withLogging(
  async (_req: NextRequest, ctx: unknown) => {
    try {
      const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
      const auth = await requireAuth();

      const rl = apiRateLimiter.check(auth.userId);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
        );
      }

      const connector = await loadConnector(id, auth.orgId);
      if (!connector) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const db = getAdminClient();
      const { data: syncs } = await db
        .from("connector_syncs")
        .select("*")
        .eq("connector_id", id)
        .order("started_at", { ascending: false })
        .limit(20);

      return NextResponse.json({
        data: {
          ...connector,
          credentials_encrypted: undefined,
          syncs: syncs ?? [],
        },
      });
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  },
);

export const PATCH = withLogging(
  async (req: NextRequest, ctx: unknown) => {
    try {
      const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
      const auth = await requireRole("admin");

      const connector = await loadConnector(id, auth.orgId);
      if (!connector) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const body = (await req.json()) as {
        name?: string;
        credentials?: Record<string, string>;
        config?: Record<string, unknown>;
        enabled?: boolean;
      };

      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.config !== undefined) updates.config = body.config;
      if (body.enabled !== undefined) updates.enabled = body.enabled;

      if (body.credentials) {
        const impl = getConnector(connector.kind as never);
        const validation = await impl.validate(body.credentials);
        if (!validation.valid) {
          return NextResponse.json(
            { error: `Credential validation failed: ${validation.error}` },
            { status: 422 },
          );
        }
        updates.credentials_encrypted = encrypt(
          JSON.stringify(body.credentials),
        );
        updates.status = "active";
      }

      const db = getAdminClient();
      const { data: updated, error } = await db
        .from("connectors")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      await auditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        actorEmail: auth.email,
        action: "connector.updated",
        resourceType: "connector",
        resourceId: id,
        metadata: { fields: Object.keys(updates) },
        req,
      });

      return NextResponse.json({
        data: { ...updated, credentials_encrypted: undefined },
      });
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  },
);

export const DELETE = withLogging(
  async (req: NextRequest, ctx: unknown) => {
    try {
      const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
      const auth = await requireRole("admin");

      const connector = await loadConnector(id, auth.orgId);
      if (!connector) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const db = getAdminClient();
      await db
        .from("connectors")
        .update({
          status: "disconnected",
          enabled: false,
          credentials_encrypted: "",
        })
        .eq("id", id);

      await auditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        actorEmail: auth.email,
        action: "connector.deleted",
        resourceType: "connector",
        resourceId: id,
        req,
      });

      return NextResponse.json({ success: true });
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  },
);
