import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import { withLogging } from "@/lib/api-handler";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const POST = withLogging(async (req: NextRequest) => {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const body = await req.json() as { ids?: string[]; all?: boolean };

  if (!body.all && (!body.ids || body.ids.length === 0)) {
    return NextResponse.json({ error: "Provide ids array or { all: true }" }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (body.all) {
    const { error } = await db
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .is("read_at", null);

    if (error) {
      logger.error({ error }, "POST /api/notifications/read mark-all error");
      return NextResponse.json({ error: "Failed to mark notifications as read" }, { status: 500 });
    }
  } else if (body.ids?.length) {
    const { error } = await db
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .in("id", body.ids);

    if (error) {
      logger.error({ error }, "POST /api/notifications/read mark-ids error");
      return NextResponse.json({ error: "Failed to mark notifications as read" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
});
