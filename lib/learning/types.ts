/**
 * Shared types for the self-learning execution engine.
 *
 * These mirror the DB schema in supabase/migrations/010_self_learning_engine.sql
 * and are used across the ingest, runner, mistake-detector, and improvement
 * engine layers.
 */

export type LearningSourceType = "github" | "upload" | "manual";

export interface LearningProject {
  id: string;
  label: string;
  source_type: LearningSourceType;
  source_url: string | null;
  language: string | null;
  metadata: Record<string, unknown>;
  ingested_at: string;
  ingested_by: string | null;
  notes: string | null;
}

export interface LearningProjectFile {
  id: string;
  project_id: string;
  file_path: string;
  content: string;
  size_bytes: number;
  sha256: string;
  ingested_at: string;
}

export type LearningScanStatus = "pending" | "running" | "completed" | "failed";

export interface LearningScan {
  id: string;
  project_id: string;
  engine_version: string;
  pattern_version: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  status: LearningScanStatus;
  error_message: string | null;
  total_findings: number;
  manifest_findings: number;
  env_findings: number;
  code_findings: number;
}

export type LearningSourceKind = "code" | "manifest" | "env" | "path_context";

export interface LearningFinding {
  id: string;
  scan_id: string;
  project_id: string;
  source_kind: LearningSourceKind;
  file_path: string;
  pattern_matched: string;
  provider: string | null;
  path_context: string | null;
  is_framework_repo: boolean;
  is_educational: boolean;
  confidence: number;
  risk_level: string;
  raw_metadata: Record<string, unknown>;
  created_at: string;
}

export type LearningMistakeType =
  | "obvious_miss"
  | "weak_signal"
  | "false_positive"
  | "inconsistent_scoring"
  | "zero_findings_high_signal"
  | "conflicting_classification";

export type LearningMistakeStatus =
  | "open"
  | "reviewed"
  | "fix_proposed"
  | "fixed"
  | "dismissed";

export interface LearningMistake {
  id: string;
  scan_id: string;
  project_id: string;
  finding_id: string | null;
  mistake_type: LearningMistakeType;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  evidence: Record<string, unknown>;
  status: LearningMistakeStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  resolution_notes: string | null;
}

export type LearningImprovementType =
  | "new_code_pattern"
  | "new_manifest_pattern"
  | "new_env_var_pattern"
  | "new_path_signal"
  | "threshold_adjustment"
  | "confidence_tuning"
  | "exclusion_addition";

export type LearningImprovementStatus =
  | "proposed"
  | "approved"
  | "applied"
  | "rejected"
  | "reverted";

export interface LearningImprovement {
  id: string;
  mistake_id: string | null;
  improvement_type: LearningImprovementType;
  title: string;
  rationale: string;
  proposed_change: Record<string, unknown>;
  status: LearningImprovementStatus;
  created_at: string;
  applied_at: string | null;
  applied_by: string | null;
  reverted_at: string | null;
}

/**
 * The engine version is embedded in every learning_scans row so we can
 * tell whether two scans used the same detection logic. Bump this when
 * you change any pattern list, threshold, or classifier function.
 *
 * Convention: engine-vN.N.N where the major.minor.patch tracks the
 * shape of detection output (not semver of the package).
 */
export const ENGINE_VERSION = "engine-v1.2.0";

/** Result shape returned from the runner to the DB writer. */
export interface RunnerFinding {
  source_kind: LearningSourceKind;
  file_path: string;
  pattern_matched: string;
  provider: string | null;
  path_context: string | null;
  is_framework_repo: boolean;
  is_educational: boolean;
  confidence: number;
  risk_level: string;
  raw_metadata: Record<string, unknown>;
}

export interface RunnerResult {
  findings: RunnerFinding[];
  counts: {
    total: number;
    manifest: number;
    env: number;
    code: number;
  };
}
