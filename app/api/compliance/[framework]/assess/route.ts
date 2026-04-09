import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import { getOrCreateOrgForUser, requireOrgMember } from "@/lib/org";
import { auditLog } from "@/lib/audit";
import { withLogging } from "@/lib/api-handler";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const POST = withLogging(async (
  req: NextRequest,
  ctx: unknown,
) => {
  const { framework } = (ctx as { params: Promise<{ framework: string }> }).params
    ? await (ctx as { params: Promise<{ framework: string }> }).params
    : { framework: "" };

  if (!framework) {
    return NextResponse.json({ error: "Framework code is required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOrCreateOrgForUser(user.id, user.email!);
  await requireOrgMember(user.id, org.id, "operator");

  const db = getAdminClient();
  const body = await req.json() as {
    assetId: string;
    controlId: string;
    status: string;
    evidence?: string[];
    notes?: string;
  };

  if (!body.assetId || !body.controlId || !body.status) {
    return NextResponse.json({ error: "assetId, controlId, and status are required" }, { status: 400 });
  }

  const validStatuses = ["compliant", "non_compliant", "not_applicable", "needs_review"];
  if (!validStatuses.includes(body.status)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
  }

  // Verify the asset belongs to this org
  const { data: asset } = await db
    .from("assets")
    .select("id")
    .eq("id", body.assetId)
    .eq("org_id", org.id)
    .single();

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  // Look up framework ID from DB
  const { data: fw } = await db
    .from("compliance_frameworks")
    .select("id")
    .eq("code", framework)
    .limit(1)
    .single();

  if (!fw) {
    return NextResponse.json({ error: "Framework not found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  // Upsert compliance mapping
  const { data: existing } = await db
    .from("compliance_mappings")
    .select("id")
    .eq("org_id", org.id)
    .eq("asset_id", body.assetId)
    .eq("framework_id", fw.id)
    .eq("control_id", body.controlId)
    .single();

  let mapping;
  if (existing) {
    const { data, error } = await db
      .from("compliance_mappings")
      .update({
        status: body.status,
        evidence: body.evidence ?? [],
        notes: body.notes ?? null,
        assessed_by: user.id,
        assessed_at: now,
        updated_at: now,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      logger.error({ error }, "POST /api/compliance/[framework]/assess update error");
      return NextResponse.json({ error: "Failed to update assessment" }, { status: 500 });
    }
    mapping = data;
  } else {
    const { data, error } = await db
      .from("compliance_mappings")
      .insert({
        org_id: org.id,
        asset_id: body.assetId,
        framework_id: fw.id,
        control_id: body.controlId,
        status: body.status,
        evidence: body.evidence ?? [],
        notes: body.notes ?? null,
        assessed_by: user.id,
        assessed_at: now,
      })
      .select()
      .single();

    if (error) {
      logger.error({ error }, "POST /api/compliance/[framework]/assess insert error");
      return NextResponse.json({ error: "Failed to create assessment" }, { status: 500 });
    }
    mapping = data;
  }

  await auditLog({
    orgId: org.id,
    actorId: user.id,
    actorEmail: user.email,
    action: "compliance.assessed",
    resourceType: "compliance_mapping",
    resourceId: mapping?.id,
    metadata: {
      framework,
      controlId: body.controlId,
      assetId: body.assetId,
      status: body.status,
    },
    req,
  });

  return NextResponse.json({ data: mapping });
});
