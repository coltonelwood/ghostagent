import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { adminClient } from "@/lib/supabase/admin";
import { getOrCreateOrgForUser, requireOrgMember, getOrgConnectorCount } from "@/lib/org";
import { encryptCredentials } from "@/lib/crypto";
import { getConnector, getConnectorDefinition } from "@/lib/connectors";
import { canAddConnector } from "@/lib/entitlements";
import { auditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";
import type { Organization } from "@/lib/types/platform";

export const dynamic = "force-dynamic";

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const org = await getOrCreateOrgForUser(user.id, user.email!);

    const { data: connectors, error } = await adminClient
      .from("connectors")
      .select("*")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data: connectors ?? [] });
  } catch (err) {
    logger.error({ err }, "GET /api/connectors error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: {
      org_id?: string;
      kind?: string;
      name?: string;
      credentials?: Record<string, string>;
      config?: Record<string, unknown>;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be JSON." },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 },
      );
    }
    if (!body.kind || typeof body.kind !== "string") {
      return NextResponse.json(
        { error: "A connector kind is required." },
        { status: 400 },
      );
    }
    if (
      !body.credentials ||
      typeof body.credentials !== "object" ||
      Array.isArray(body.credentials)
    ) {
      return NextResponse.json(
        { error: "Credentials must be provided as an object." },
        { status: 400 },
      );
    }
    // Cap the payload size to prevent oversized DB writes / memory blowup.
    const credBytes = JSON.stringify(body.credentials).length;
    if (credBytes > 10_000) {
      return NextResponse.json(
        { error: "Credential payload is too large." },
        { status: 413 },
      );
    }

    let org: Organization;
    if (body.org_id) {
      await requireOrgMember(user.id, body.org_id, "admin");
      const { data } = await adminClient.from("organizations").select("*").eq("id", body.org_id).single();
      if (!data) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
      org = data as Organization;
    } else {
      org = await getOrCreateOrgForUser(user.id, user.email!);
    }

    const currentCount = await getOrgConnectorCount(org.id);
    if (!canAddConnector(org, currentCount)) {
      return NextResponse.json({
        error: `Your ${org.plan} plan allows a maximum of ${org.max_connectors} connectors.`,
        code: "ENTITLEMENT_ERROR",
      }, { status: 402 });
    }

    const kind = body.kind;
    const credentials = body.credentials;
    const def = getConnectorDefinition(kind as never);
    if (!def) return NextResponse.json({ error: `Unknown connector kind: ${kind}` }, { status: 400 });

    const impl = getConnector(kind as never);
    const validation = await impl.validate(credentials);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: `Couldn't verify those credentials${validation.error ? `: ${validation.error}` : "."} Double-check the values and try again.`,
        },
        { status: 422 },
      );
    }

    const encryptedCreds = encryptCredentials(credentials);

    const { data: connector, error } = await adminClient
      .from("connectors")
      .insert({
        org_id: org.id,
        kind,
        name: body.name || `${def.displayName} — ${org.name}`,
        status: "active",
        credentials_encrypted: encryptedCreds,
        config: body.config ?? {},
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    await auditLog({
      orgId: org.id, actorId: user.id, actorEmail: user.email,
      action: "connector.created", resourceType: "connector", resourceId: connector.id,
      metadata: { kind, name: connector.name }, req,
    });

    // Dispatch initial sync in the background. Requires both env vars
    // to be configured — env.ts fails startup otherwise, so this is
    // guaranteed in production but defensive in development.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    const internalKey = process.env.INTERNAL_API_KEY;
    if (baseUrl && internalKey) {
      fetch(`${baseUrl.replace(/\/$/, "")}/api/internal/sync-worker`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-key": internalKey,
        },
        body: JSON.stringify({ connectorId: connector.id }),
        signal: AbortSignal.timeout(10_000),
      }).catch((err) =>
        logger.error(
          { connectorId: connector.id, err },
          "initial sync dispatch failed",
        ),
      );
    }

    return NextResponse.json({ data: { ...connector, credentials_encrypted: undefined } }, { status: 201 });
  } catch (err) {
    logger.error({ err }, "POST /api/connectors error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
