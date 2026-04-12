import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { authorizeLearningRequest } from "@/lib/learning/guard";
import { runLearningScan } from "@/lib/learning/runner";
import { detectMistakes } from "@/lib/learning/detect-mistakes";
import { proposeImprovementsForMistake } from "@/lib/learning/propose-improvements";
import { ENGINE_VERSION } from "@/lib/learning/types";
import { logger } from "@/lib/logger";
import type { LearningFinding } from "@/lib/learning/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/learning/projects/[id]/scan
 *
 * Execute a full learning scan against a stored project:
 *   1. Load project + files from DB
 *   2. Call runLearningScan (pure function, real detection logic)
 *   3. Persist learning_scans + learning_findings rows
 *   4. Run rule-based mistake detector over the persisted findings
 *   5. Persist learning_mistakes rows
 *   6. Propose improvements for each mistake (stored as "proposed",
 *      never auto-applied)
 *
 * Safety: enforces a 5-scans-per-project-per-hour rate limit at the
 * row level so a background loop can't runaway.
 */
export async function POST(req: NextRequest, ctx: unknown) {
  const auth = await authorizeLearningRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;

  // Rate limit: no more than 5 scans per project in the trailing hour.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await adminClient
    .from("learning_scans")
    .select("*", { count: "exact", head: true })
    .eq("project_id", id)
    .gte("started_at", oneHourAgo);
  if ((recentCount ?? 0) >= 5) {
    return NextResponse.json(
      {
        error:
          "Scan rate limit exceeded for this project. Try again in an hour.",
      },
      { status: 429 },
    );
  }

  // Load project + files.
  const { data: project, error: projectErr } = await adminClient
    .from("learning_projects")
    .select("*")
    .eq("id", id)
    .single();
  if (projectErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: files, error: filesErr } = await adminClient
    .from("learning_project_files")
    .select("file_path, content")
    .eq("project_id", id);
  if (filesErr) {
    return NextResponse.json(
      { error: "Failed to load project files" },
      { status: 500 },
    );
  }
  if (!files || files.length === 0) {
    return NextResponse.json(
      { error: "Project has no stored files." },
      { status: 400 },
    );
  }

  // Create a pending scan row so the UI can poll.
  const { data: scanRow, error: scanErr } = await adminClient
    .from("learning_scans")
    .insert({
      project_id: id,
      engine_version: ENGINE_VERSION,
      status: "running",
    })
    .select()
    .single();
  if (scanErr || !scanRow) {
    return NextResponse.json(
      { error: "Failed to create scan row" },
      { status: 500 },
    );
  }

  const t0 = Date.now();
  let runnerResult;
  try {
    runnerResult = runLearningScan(
      {
        label: project.label,
        source_type: project.source_type,
        source_url: project.source_url,
        metadata: project.metadata ?? {},
      },
      files,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Runner error";
    logger.error(
      { err: msg, scanId: scanRow.id },
      "learning: runner threw",
    );
    await adminClient
      .from("learning_scans")
      .update({
        status: "failed",
        error_message: msg,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - t0,
      })
      .eq("id", scanRow.id);
    return NextResponse.json(
      { error: "Scanner failed", detail: msg },
      { status: 500 },
    );
  }

  // Persist findings.
  const findingRows = runnerResult.findings.map((f) => ({
    scan_id: scanRow.id,
    project_id: id,
    source_kind: f.source_kind,
    file_path: f.file_path,
    pattern_matched: f.pattern_matched,
    provider: f.provider,
    path_context: f.path_context,
    is_framework_repo: f.is_framework_repo,
    is_educational: f.is_educational,
    confidence: f.confidence,
    risk_level: f.risk_level,
    raw_metadata: f.raw_metadata,
  }));

  let persistedFindings: LearningFinding[] = [];
  if (findingRows.length > 0) {
    const { data: inserted, error: findingErr } = await adminClient
      .from("learning_findings")
      .insert(findingRows)
      .select();
    if (findingErr) {
      logger.error(
        { err: findingErr, scanId: scanRow.id },
        "learning: failed to insert findings",
      );
    } else {
      persistedFindings = (inserted ?? []) as LearningFinding[];
    }
  }

  // Update scan row with summary counts.
  await adminClient
    .from("learning_scans")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - t0,
      total_findings: runnerResult.counts.total,
      manifest_findings: runnerResult.counts.manifest,
      env_findings: runnerResult.counts.env,
      code_findings: runnerResult.counts.code,
    })
    .eq("id", scanRow.id);

  // Run mistake detector.
  const mistakeCandidates = detectMistakes({
    scanId: scanRow.id,
    projectId: id,
    findings: persistedFindings,
    files,
    projectLabel: project.label,
  });

  let persistedMistakeIds: string[] = [];
  if (mistakeCandidates.length > 0) {
    const { data: insertedMistakes, error: mErr } = await adminClient
      .from("learning_mistakes")
      .insert(mistakeCandidates)
      .select("id, scan_id, project_id, mistake_type, severity, evidence, status, finding_id, description, created_at, reviewed_at, reviewed_by, resolution_notes");
    if (mErr) {
      logger.error(
        { err: mErr, scanId: scanRow.id },
        "learning: failed to insert mistakes",
      );
    } else if (insertedMistakes) {
      persistedMistakeIds = insertedMistakes.map((m) => m.id);
      // Auto-propose improvements for each persisted mistake. The
      // proposals are stored as status="proposed" — never applied.
      for (const mistake of insertedMistakes) {
        const proposals = proposeImprovementsForMistake(
          mistake as unknown as import("@/lib/learning/types").LearningMistake,
        );
        if (proposals.length > 0) {
          await adminClient
            .from("learning_improvements")
            .insert(proposals);
        }
      }
    }
  }

  logger.info(
    {
      scanId: scanRow.id,
      projectId: id,
      findings: runnerResult.counts.total,
      mistakes: mistakeCandidates.length,
    },
    "learning: scan complete",
  );

  return NextResponse.json({
    data: {
      scan_id: scanRow.id,
      counts: runnerResult.counts,
      mistake_count: mistakeCandidates.length,
      mistake_ids: persistedMistakeIds,
    },
  });
}
