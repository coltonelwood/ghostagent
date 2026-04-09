import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { adminClient } from "@/lib/supabase/admin";
import { getOrCreateOrgForUser, requireOrgMember } from "@/lib/org";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Params = { framework: string; controlId: string };

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

/** PATCH /api/compliance/[framework]/controls/[controlId] — update control status org-wide */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { framework, controlId } = await params;
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const org = await getOrCreateOrgForUser(user.id, user.email!);
    await requireOrgMember(user.id, org.id, "operator");

    const body = await req.json() as {
      status: "compliant" | "non_compliant" | "not_applicable" | "needs_review" | "unknown";
      notes?: string;
      evidence?: string[];
    };

    if (!body.status) return NextResponse.json({ error: "status is required" }, { status: 400 });

    // Find the framework row
    const { data: fw } = await adminClient
      .from("compliance_frameworks")
      .select("id")
      .eq("code", framework)
      .or(`org_id.is.null,org_id.eq.${org.id}`)
      .single();

    if (!fw) return NextResponse.json({ error: "Framework not found" }, { status: 404 });

    // Upsert a single org-level mapping (not per-asset — org-wide assessment)
    const { error } = await adminClient
      .from("compliance_mappings")
      .upsert({
        org_id: org.id,
        asset_id: "00000000-0000-0000-0000-000000000000", // sentinel: org-level mapping
        framework_id: fw.id,
        control_id: controlId,
        status: body.status,
        notes: body.notes ?? null,
        evidence: body.evidence ?? [],
        assessed_by: user.id,
        assessed_at: new Date().toISOString(),
      }, { onConflict: "org_id,asset_id,framework_id,control_id" });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, framework, controlId }, "PATCH /api/compliance/[framework]/controls/[controlId] error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
