import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import { getOrCreateOrgForUser, requireOrgMember } from "@/lib/org";
import { auditLog } from "@/lib/audit";
import { withLogging } from "@/lib/api-handler";
import { logger } from "@/lib/logger";

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

export const GET = withLogging(async () => {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOrCreateOrgForUser(user.id, user.email!);
  const db = getAdminClient();

  // Get usage counts in parallel
  const [memberCountRes, assetCountRes, connectorCountRes] = await Promise.all([
    db.from("org_members").select("*", { count: "exact", head: true }).eq("org_id", org.id),
    db.from("assets").select("*", { count: "exact", head: true }).eq("org_id", org.id).eq("status", "active"),
    db.from("connectors").select("*", { count: "exact", head: true }).eq("org_id", org.id).neq("status", "disconnected"),
  ]);

  return NextResponse.json({
    data: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      sdk_api_key: org.sdk_api_key,
      settings: org.settings,
      created_at: org.created_at,
      updated_at: org.updated_at,
      memberCount: memberCountRes.count ?? 0,
      assetCount: assetCountRes.count ?? 0,
      connectorCount: connectorCountRes.count ?? 0,
    },
  });
});

export const PATCH = withLogging(async (req: NextRequest) => {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOrCreateOrgForUser(user.id, user.email!);
  await requireOrgMember(user.id, org.id, "admin");

  const db = getAdminClient();
  const body = await req.json() as { name?: string; settings?: Record<string, unknown> };
  const updates: Record<string, unknown> = {};
  if (body.name) updates.name = body.name.slice(0, 100);
  if (body.settings) updates.settings = body.settings;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data: updated, error } = await db
    .from("organizations")
    .update(updates)
    .eq("id", org.id)
    .select()
    .single();

  if (error) {
    logger.error({ error }, "PATCH /api/org error");
    return NextResponse.json({ error: "Failed to update organization" }, { status: 500 });
  }

  await auditLog({
    orgId: org.id,
    actorId: user.id,
    actorEmail: user.email,
    action: "org.updated",
    resourceType: "organization",
    resourceId: org.id,
    metadata: { fields: Object.keys(updates) },
    req,
  });

  return NextResponse.json({
    data: { ...updated, stripe_customer_id: undefined, stripe_subscription_id: undefined },
  });
});
