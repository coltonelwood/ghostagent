import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import { getOrCreateOrgForUser, requireOrgMember } from "@/lib/org";
import { auditLog } from "@/lib/audit";
import { emitEvent } from "@/lib/event-system";
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

export const GET = withLogging(async (req: NextRequest) => {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOrCreateOrgForUser(user.id, user.email!);
  await requireOrgMember(user.id, org.id, "viewer");

  const db = getAdminClient();
  const url = new URL(req.url);

  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);
  const offset = (page - 1) * limit;
  const status = url.searchParams.get("status");
  const priority = url.searchParams.get("priority");
  const assignedTo = url.searchParams.get("assignedTo");
  const assetId = url.searchParams.get("assetId");

  let query = db
    .from("tasks")
    .select("*, assets(id, name, source)", { count: "exact" })
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  if (assignedTo) query = query.eq("assigned_to", assignedTo);
  if (assetId) query = query.eq("asset_id", assetId);

  const { data, count, error } = await query;
  if (error) {
    logger.error({ error }, "GET /api/tasks query error");
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    hasMore: (offset + limit) < (count ?? 0),
  });
});

export const POST = withLogging(async (req: NextRequest) => {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOrCreateOrgForUser(user.id, user.email!);
  await requireOrgMember(user.id, org.id, "operator");

  const db = getAdminClient();
  const body = await req.json() as {
    title: string;
    description?: string;
    priority?: string;
    asset_id?: string;
    violation_id?: string;
    assigned_to?: string;
    due_at?: string;
  };

  if (!body.title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const validPriorities = ["low", "medium", "high", "critical"];
  if (body.priority && !validPriorities.includes(body.priority)) {
    return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
  }

  // If asset_id is provided, verify it belongs to this org
  if (body.asset_id) {
    const { data: asset } = await db
      .from("assets")
      .select("id")
      .eq("id", body.asset_id)
      .eq("org_id", org.id)
      .single();

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
  }

  const { data: task, error } = await db
    .from("tasks")
    .insert({
      org_id: org.id,
      title: body.title,
      description: body.description ?? null,
      priority: body.priority ?? "medium",
      status: "open",
      asset_id: body.asset_id ?? null,
      violation_id: body.violation_id ?? null,
      assigned_to: body.assigned_to ?? null,
      due_at: body.due_at ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error }, "POST /api/tasks insert error");
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }

  await emitEvent({
    orgId: org.id,
    kind: "task_created",
    severity: "info",
    title: `New task: ${body.title}`,
    actorId: user.id,
    assetId: body.asset_id,
    metadata: { taskId: task?.id, priority: body.priority ?? "medium" },
  });

  await auditLog({
    orgId: org.id,
    actorId: user.id,
    actorEmail: user.email,
    action: "task.created",
    resourceType: "task",
    resourceId: task?.id,
    metadata: { title: body.title, priority: body.priority ?? "medium" },
    req,
  });

  return NextResponse.json({ data: task }, { status: 201 });
});
