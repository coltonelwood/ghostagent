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

export const PATCH = withLogging(async (
  req: NextRequest,
  ctx: unknown,
) => {
  const { id: taskId } = await (ctx as { params: Promise<{ id: string }> }).params;

  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOrCreateOrgForUser(user.id, user.email!);
  await requireOrgMember(user.id, org.id, "operator");

  const db = getAdminClient();

  // Verify task belongs to this org
  const { data: existingTask } = await db
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("org_id", org.id)
    .single();

  if (!existingTask) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const body = await req.json() as {
    title?: string;
    description?: string | null;
    status?: string;
    priority?: string;
    assigned_to?: string | null;
    due_at?: string | null;
    notes?: string | null;
  };

  const validStatuses = ["open", "in_progress", "completed", "cancelled"];
  if (body.status && !validStatuses.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const validPriorities = ["low", "medium", "high", "critical"];
  if (body.priority && !validPriorities.includes(body.priority)) {
    return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.status !== undefined) updates.status = body.status;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to;
  if (body.due_at !== undefined) updates.due_at = body.due_at;
  if (body.notes !== undefined) updates.notes = body.notes;

  // Set completed_at when status changes to completed
  if (body.status === "completed" && existingTask.status !== "completed") {
    updates.completed_at = new Date().toISOString();
  }

  updates.updated_at = new Date().toISOString();

  const { data: updated, error } = await db
    .from("tasks")
    .update(updates)
    .eq("id", taskId)
    .select()
    .single();

  if (error) {
    logger.error({ error }, "PATCH /api/tasks/[id] error");
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }

  // Emit event if task completed
  if (body.status === "completed" && existingTask.status !== "completed") {
    await emitEvent({
      orgId: org.id,
      kind: "task_completed",
      severity: "info",
      title: `Task completed: ${existingTask.title}`,
      actorId: user.id,
      assetId: existingTask.asset_id,
      metadata: { taskId },
    });
  }

  await auditLog({
    orgId: org.id,
    actorId: user.id,
    actorEmail: user.email,
    action: "task.updated",
    resourceType: "task",
    resourceId: taskId,
    metadata: { fields: Object.keys(updates).filter((k) => k !== "updated_at") },
    req,
  });

  return NextResponse.json({ data: updated });
});

export const DELETE = withLogging(async (
  req: NextRequest,
  ctx: unknown,
) => {
  const { id: taskId } = await (ctx as { params: Promise<{ id: string }> }).params;

  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOrCreateOrgForUser(user.id, user.email!);
  await requireOrgMember(user.id, org.id, "admin");

  const db = getAdminClient();

  // Verify task belongs to this org
  const { data: existingTask } = await db
    .from("tasks")
    .select("id, title")
    .eq("id", taskId)
    .eq("org_id", org.id)
    .single();

  if (!existingTask) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const { error } = await db
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("org_id", org.id);

  if (error) {
    logger.error({ error }, "DELETE /api/tasks/[id] error");
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }

  await auditLog({
    orgId: org.id,
    actorId: user.id,
    actorEmail: user.email,
    action: "task.deleted",
    resourceType: "task",
    resourceId: taskId,
    metadata: { title: existingTask.title },
    req,
  });

  return NextResponse.json({ success: true });
});
