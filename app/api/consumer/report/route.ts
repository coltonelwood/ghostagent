import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, AuthError } from "@/lib/org-auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { processConsumerReport } from "@/lib/threat-intelligence";
import { withLogging } from "@/lib/api-handler";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const GET = withLogging(async (req: NextRequest) => {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
    const offset = parseInt(searchParams.get("offset") ?? "0");

    const db = getAdminClient();
    let query = db
      .from("threat_reports")
      .select("*", { count: "exact" })
      .eq("reporter_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) query = query.eq("report_type", type);
    if (status) query = query.eq("status", status);

    const { data, count, error } = await query;

    if (error) {
      logger.error({ error }, "GET /api/consumer/report query error");
      return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
    }

    return NextResponse.json({
      data: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});

export const POST = withLogging(async (req: NextRequest) => {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      report_type: string;
      title: string;
      description?: string;
      evidence?: {
        raw_content?: string;
        sender?: string;
        urls?: string[];
        phone_numbers?: string[];
      };
    };

    if (!body.report_type || !body.title) {
      return NextResponse.json(
        { error: "report_type and title are required" },
        { status: 400 },
      );
    }

    const db = getAdminClient();
    const { data: report, error } = await db
      .from("threat_reports")
      .insert({
        reporter_id: user.id,
        report_type: body.report_type,
        title: body.title,
        description: body.description ?? null,
        evidence: body.evidence ?? {},
        status: "pending",
      })
      .select("*")
      .single();

    if (error) {
      logger.error({ error }, "POST /api/consumer/report insert error");
      return NextResponse.json({ error: "Failed to create report" }, { status: 500 });
    }

    // Process report in the background -- don't await
    processConsumerReport(report.id).catch((err) => {
      logger.error({ error: err, reportId: report.id }, "Background processConsumerReport failed");
    });

    return NextResponse.json({ data: report }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});
