import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { authorizeLearningRequest } from "@/lib/learning/guard";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set([
  "open",
  "reviewed",
  "fix_proposed",
  "fixed",
  "dismissed",
]);

/**
 * PATCH /api/learning/mistakes/[id]
 *
 * Update mistake status. Used by the review queue UI.
 * Body: { status: LearningMistakeStatus, resolution_notes?: string }
 */
export async function PATCH(req: NextRequest, ctx: unknown) {
  const auth = await authorizeLearningRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;

  let body: { status?: string; resolution_notes?: string };
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

  const update: Record<string, unknown> = {
    status: body.status,
    reviewed_at: new Date().toISOString(),
    reviewed_by: auth.actor,
  };
  if (typeof body.resolution_notes === "string") {
    update.resolution_notes = body.resolution_notes.slice(0, 2000);
  }

  const { data, error } = await adminClient
    .from("learning_mistakes")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ data });
}
