import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { authorizeLearningRequest } from "@/lib/learning/guard";
import { normalizeProject, IngestionError } from "@/lib/learning/ingest";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/learning/projects
 * Ingest a new learning project. Accepts raw file content — we store
 * it so every scan against this project is reproducible.
 */
export async function POST(req: NextRequest) {
  const auth = await authorizeLearningRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  let body: {
    label?: string;
    source_type?: "github" | "upload" | "manual";
    source_url?: string;
    language?: string;
    metadata?: Record<string, unknown>;
    files?: Array<{ file_path: string; content: string }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON." },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Request body must be a JSON object." },
      { status: 400 },
    );
  }
  if (!body.source_type || !["github", "upload", "manual"].includes(body.source_type)) {
    return NextResponse.json(
      { error: "source_type must be one of: github, upload, manual." },
      { status: 400 },
    );
  }

  let normalized;
  try {
    normalized = normalizeProject({
      label: body.label ?? "",
      source_type: body.source_type,
      source_url: body.source_url,
      language: body.language,
      metadata: body.metadata,
      files: body.files ?? [],
    });
  } catch (err) {
    if (err instanceof IngestionError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400 },
      );
    }
    throw err;
  }

  const { data: project, error: projectErr } = await adminClient
    .from("learning_projects")
    .insert({
      label: normalized.label,
      source_type: normalized.source_type,
      source_url: normalized.source_url,
      language: normalized.language,
      metadata: normalized.metadata,
      ingested_by: auth.actor,
    })
    .select()
    .single();

  if (projectErr || !project) {
    logger.error({ err: projectErr }, "learning: failed to insert project");
    return NextResponse.json(
      { error: "Failed to create learning project." },
      { status: 500 },
    );
  }

  // Bulk insert files. Chunk so a ~2000-file project doesn't blow up
  // a single INSERT statement.
  const rows = normalized.files.map((f) => ({
    project_id: project.id,
    file_path: f.file_path,
    content: f.content,
    size_bytes: f.size_bytes,
    sha256: f.sha256,
  }));
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error: fileErr } = await adminClient
      .from("learning_project_files")
      .insert(slice);
    if (fileErr) {
      logger.error(
        { err: fileErr, projectId: project.id },
        "learning: failed to insert project files",
      );
      // Best-effort cleanup so we don't leave a half-ingested project.
      await adminClient
        .from("learning_projects")
        .delete()
        .eq("id", project.id);
      return NextResponse.json(
        { error: "Failed to store project files." },
        { status: 500 },
      );
    }
  }

  logger.info(
    { projectId: project.id, fileCount: rows.length },
    "learning: project ingested",
  );
  return NextResponse.json(
    { data: { project, file_count: rows.length } },
    { status: 201 },
  );
}

/**
 * GET /api/learning/projects
 * List ingested projects with scan summary.
 */
export async function GET(req: NextRequest) {
  const auth = await authorizeLearningRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { data: projects } = await adminClient
    .from("learning_projects")
    .select("*")
    .order("ingested_at", { ascending: false })
    .limit(200);

  return NextResponse.json({ data: projects ?? [] });
}
