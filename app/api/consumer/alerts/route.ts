import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, AuthError } from "@/lib/org-auth";
import { getIndividualAlerts } from "@/lib/threat-intelligence";
import { withLogging } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withLogging(async (req: NextRequest) => {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") ?? "20");
    const unreadOnly = searchParams.get("unread_only") === "true";

    const alerts = await getIndividualAlerts(user.id, {
      limit: Math.min(limit, 50),
      unread_only: unreadOnly,
    });

    return NextResponse.json({ data: alerts });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});
