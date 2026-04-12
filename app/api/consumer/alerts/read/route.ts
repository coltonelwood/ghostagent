import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, AuthError } from "@/lib/org-auth";
import { markAlertsRead } from "@/lib/threat-intelligence";
import { withLogging } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const POST = withLogging(async (req: NextRequest) => {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { alert_ids: string[] };

    if (!Array.isArray(body.alert_ids) || body.alert_ids.length === 0) {
      return NextResponse.json(
        { error: "alert_ids must be a non-empty array" },
        { status: 400 },
      );
    }

    await markAlertsRead(user.id, body.alert_ids);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});
