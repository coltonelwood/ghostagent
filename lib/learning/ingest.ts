/**
 * Ingestion for the self-learning execution engine.
 *
 * Accepts file content from any source (GitHub, upload, manual paste),
 * normalizes it, and stores it in learning_project_files. The runner
 * reads from the DB — it never re-fetches from the original source.
 * This makes every scan reproducible.
 *
 * Size + count caps are enforced here so a stray 100MB file can't
 * blow up memory.
 */

import { createHash } from "crypto";

export interface IncomingFile {
  file_path: string;
  content: string;
}

export interface NormalizedProject {
  label: string;
  source_type: "github" | "upload" | "manual";
  source_url: string | null;
  language: string | null;
  metadata: Record<string, unknown>;
  files: Array<{
    file_path: string;
    content: string;
    size_bytes: number;
    sha256: string;
  }>;
}

export class IngestionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "IngestionError";
  }
}

const MAX_FILES_PER_PROJECT = 2_000;
const MAX_FILE_BYTES = 500_000;
const MAX_TOTAL_BYTES = 50_000_000;
// Extensions / paths we refuse to ingest even if passed in. Lock files
// and binary blobs create noise without ever producing useful findings.
const INGEST_IGNORE: RegExp[] = [
  /\/node_modules\//i,
  /package-lock\.json$/i,
  /yarn\.lock$/i,
  /pnpm-lock\.yaml$/i,
  /Cargo\.lock$/i,
  /poetry\.lock$/i,
  /\.min\.(js|css)$/i,
  /\.(png|jpe?g|gif|webp|pdf|zip|gz|wasm|ico|woff2?)$/i,
];

function shouldIgnore(filePath: string): boolean {
  return INGEST_IGNORE.some((p) => p.test(filePath));
}

/**
 * Normalize raw incoming files into a persisted-project shape. Applies
 * size caps, content hashing, and the ignore list. Pure — no DB
 * writes here, the API route is responsible for persistence.
 */
export function normalizeProject(input: {
  label: string;
  source_type: "github" | "upload" | "manual";
  source_url?: string | null;
  language?: string | null;
  metadata?: Record<string, unknown>;
  files: IncomingFile[];
}): NormalizedProject {
  if (!input.label?.trim()) {
    throw new IngestionError("missing_label", "Project label is required.");
  }
  if (input.label.length > 200) {
    throw new IngestionError(
      "label_too_long",
      "Project label must be 200 characters or fewer.",
    );
  }
  if (!Array.isArray(input.files)) {
    throw new IngestionError("no_files", "files must be an array.");
  }

  const normalized: NormalizedProject["files"] = [];
  let totalBytes = 0;
  let skipped = 0;

  for (const f of input.files) {
    if (!f || typeof f.file_path !== "string" || typeof f.content !== "string") {
      skipped++;
      continue;
    }
    if (shouldIgnore(f.file_path)) {
      skipped++;
      continue;
    }
    if (f.content.length === 0) {
      skipped++;
      continue;
    }
    if (f.content.length > MAX_FILE_BYTES) {
      // Truncate instead of drop — we still want the first 500KB of
      // a large file so pattern detection can find signals near the top.
      const trimmed = f.content.slice(0, MAX_FILE_BYTES);
      const sha = createHash("sha256").update(trimmed).digest("hex");
      normalized.push({
        file_path: f.file_path,
        content: trimmed,
        size_bytes: trimmed.length,
        sha256: sha,
      });
      totalBytes += trimmed.length;
    } else {
      const sha = createHash("sha256").update(f.content).digest("hex");
      normalized.push({
        file_path: f.file_path,
        content: f.content,
        size_bytes: f.content.length,
        sha256: sha,
      });
      totalBytes += f.content.length;
    }

    if (normalized.length >= MAX_FILES_PER_PROJECT) break;
    if (totalBytes >= MAX_TOTAL_BYTES) break;
  }

  if (normalized.length === 0) {
    throw new IngestionError(
      "no_usable_files",
      "No usable files after applying size and type filters.",
    );
  }

  return {
    label: input.label.trim(),
    source_type: input.source_type,
    source_url: input.source_url?.trim() || null,
    language: input.language?.trim() || null,
    metadata: {
      ...(input.metadata ?? {}),
      ingested_file_count: normalized.length,
      ingested_bytes: totalBytes,
      skipped_files: skipped,
    },
    files: normalized,
  };
}
