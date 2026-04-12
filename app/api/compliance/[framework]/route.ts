import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getOrCreateOrgForUser, requireOrgMember } from "@/lib/org";
import { complianceReport } from "@/lib/compliance/report-generator";
import { autoMapCompliance } from "@/lib/compliance/auto-mapper";
import { withLogging } from "@/lib/api-handler";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const GET = withLogging(async (
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
  await requireOrgMember(user.id, org.id, "viewer");

  try {
    await autoMapCompliance(org.id).catch((e) =>
      logger.warn({ e }, "compliance auto-map skipped")
    );
    const report = await complianceReport(org.id, framework);
    return NextResponse.json({ data: report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("Unknown framework code")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    logger.error({ err, framework }, "GET /api/compliance/[framework] error");
    return NextResponse.json({ error: "Failed to generate framework report" }, { status: 500 });
  }
});
