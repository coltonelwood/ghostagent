import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, AuthError } from "@/lib/org-auth";
import { getConsumerStats } from "@/lib/threat-intelligence";
import { withLogging } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withLogging(async (req: NextRequest) => {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stats = await getConsumerStats(user.id);

    return NextResponse.json({ data: stats });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});
