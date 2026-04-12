import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { authorizeLearningRequest } from "@/lib/learning/guard";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set([
  "proposed",
  "approved",
  "applied",
  "rejected",
  "reverted",
]);

/**
 * PATCH /api/learning/improvements/[id]
 *
 * Transition a proposed improvement between states. Applying an
 * improvement does NOT modify any code files — an operator still
 * has to make the actual source change. This endpoint just records
 * the operator's decision for audit.
 *
 * The expected workflow:
 *   proposed → approved → (operator updates source) → applied
 *     ↳ or → rejected (decline the proposal)
 *   applied → reverted (if the change caused a regression)
 */
export async function PATCH(req: NextRequest, ctx: unknown) {
  const auth = await authorizeLearningRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON." },
      { status: 400 },
    );
  }

  if (!body.status || !ALLOWED_STATUSES.has(body.status)) {
    return NextResponse.json(
      {
        error: `status must be one of: ${Array.from(ALLOWED_STATUSES).join(", ")}.`,
      },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = { status: body.status };
  if (body.status === "applied") {
    update.applied_at = new Date().toISOString();
    update.applied_by = auth.actor;
  } else if (body.status === "reverted") {
    update.reverted_at = new Date().toISOString();
  }

  const { data, error } = await adminClient
    .from("learning_improvements")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ data });
}
