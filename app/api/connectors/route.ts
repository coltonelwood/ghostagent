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

    const body = await req.json() as {
      org_id?: string;
      kind: string;
      name: string;
      credentials: Record<string, string>;
      config?: Record<string, unknown>;
    };

    if (!body.kind || !body.credentials) {
      return NextResponse.json({ error: "kind and credentials are required" }, { status: 400 });
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

    const def = getConnectorDefinition(body.kind as never);
    if (!def) return NextResponse.json({ error: `Unknown connector kind: ${body.kind}` }, { status: 400 });

    const impl = getConnector(body.kind as never);
    const validation = await impl.validate(body.credentials);
    if (!validation.valid) {
      return NextResponse.json({ error: `Credential validation failed: ${validation.error}` }, { status: 422 });
    }

    const encryptedCreds = encryptCredentials(body.credentials);

    const { data: connector, error } = await adminClient
      .from("connectors")
      .insert({
        org_id: org.id,
        kind: body.kind,
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
      metadata: { kind: body.kind, name: connector.name }, req,
    });

    // Trigger initial sync asynchronously
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/internal/sync-worker`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": process.env.INTERNAL_API_KEY ?? "" },
      body: JSON.stringify({ connectorId: connector.id }),
    }).catch(() => {});

    return NextResponse.json({ data: { ...connector, credentials_encrypted: undefined } }, { status: 201 });
  } catch (err) {
    logger.error({ err }, "POST /api/connectors error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
