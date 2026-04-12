-- ============================================================================
-- Nexus self-learning execution engine
-- ============================================================================
--
-- Internal-only tables that power the self-learning loop. The loop ingests
-- real project file content into these tables, runs the real detection
-- helpers (lib/connectors/base.ts — not a simulation, the same functions
-- the customer-facing scanner uses), records findings, detects mistakes,
-- and proposes detection improvements for human review.
--
-- These tables are NOT exposed to customer orgs. They are gated behind the
-- NEXUS_LEARNING_ENABLED env flag and accessed only via admin routes
-- protected by INTERNAL_API_KEY.
-- ============================================================================

-- --------------------------------------------------------------------------
-- Ingested projects (real file content stored here, not fetched live)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS learning_projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label           TEXT NOT NULL,
  source_type     TEXT NOT NULL CHECK (source_type IN ('github', 'upload', 'manual')),
  source_url      TEXT,
  language        TEXT,
  -- free-form metadata: contributor count, stars, etc.
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ingested_by     TEXT,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_learning_projects_source_type
  ON learning_projects (source_type);

-- --------------------------------------------------------------------------
-- Files that belong to each project. We store raw file content here so
-- detection runs against a stable, reproducible snapshot instead of
-- re-fetching from GitHub every time.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS learning_project_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES learning_projects(id) ON DELETE CASCADE,
  file_path       TEXT NOT NULL,
  -- content capped at 500KB per file at ingest time
  content         TEXT NOT NULL,
  size_bytes      INTEGER NOT NULL,
  sha256          TEXT NOT NULL,
  ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, file_path)
);

CREATE INDEX IF NOT EXISTS idx_learning_project_files_project
  ON learning_project_files (project_id);

-- --------------------------------------------------------------------------
-- Scan runs against a learning project. One row per execution. Captures
-- the engine version so we can compare before/after an improvement.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS learning_scans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES learning_projects(id) ON DELETE CASCADE,
  engine_version    TEXT NOT NULL,
  pattern_version   TEXT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  duration_ms       INTEGER,
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message     TEXT,
  total_findings    INTEGER NOT NULL DEFAULT 0,
  manifest_findings INTEGER NOT NULL DEFAULT 0,
  env_findings      INTEGER NOT NULL DEFAULT 0,
  code_findings     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_learning_scans_project
  ON learning_scans (project_id);
CREATE INDEX IF NOT EXISTS idx_learning_scans_engine
  ON learning_scans (engine_version);

-- --------------------------------------------------------------------------
-- Per-finding results. Mirrors the structure of real scanner output so the
-- mistake detector can evaluate findings with the same logic.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS learning_findings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id           UUID NOT NULL REFERENCES learning_scans(id) ON DELETE CASCADE,
  project_id        UUID NOT NULL REFERENCES learning_projects(id) ON DELETE CASCADE,
  source_kind       TEXT NOT NULL CHECK (source_kind IN ('code', 'manifest', 'env', 'path_context')),
  file_path         TEXT NOT NULL,
  pattern_matched   TEXT NOT NULL,
  provider          TEXT,
  path_context      TEXT,
  is_framework_repo BOOLEAN NOT NULL DEFAULT FALSE,
  is_educational    BOOLEAN NOT NULL DEFAULT FALSE,
  confidence        INTEGER NOT NULL DEFAULT 0,
  risk_level        TEXT NOT NULL,
  raw_metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_findings_scan
  ON learning_findings (scan_id);
CREATE INDEX IF NOT EXISTS idx_learning_findings_project
  ON learning_findings (project_id);

-- --------------------------------------------------------------------------
-- Rule-based mistakes discovered after a scan. Each mistake ties back to
-- either a specific finding or to a scan-level observation (e.g. "zero
-- findings on a project that obviously uses AI").
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS learning_mistakes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id         UUID NOT NULL REFERENCES learning_scans(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES learning_projects(id) ON DELETE CASCADE,
  finding_id      UUID REFERENCES learning_findings(id) ON DELETE SET NULL,
  mistake_type    TEXT NOT NULL CHECK (mistake_type IN (
    'obvious_miss',
    'weak_signal',
    'false_positive',
    'inconsistent_scoring',
    'zero_findings_high_signal',
    'conflicting_classification'
  )),
  severity        TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description     TEXT NOT NULL,
  evidence        JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewed', 'fix_proposed', 'fixed', 'dismissed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     TEXT,
  resolution_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_learning_mistakes_status
  ON learning_mistakes (status);
CREATE INDEX IF NOT EXISTS idx_learning_mistakes_severity
  ON learning_mistakes (severity);

-- --------------------------------------------------------------------------
-- Proposed improvements. The auto-improvement engine writes proposals here
-- but NEVER auto-applies them — an operator must explicitly mark them
-- applied after updating the actual pattern files.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS learning_improvements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mistake_id        UUID REFERENCES learning_mistakes(id) ON DELETE SET NULL,
  improvement_type  TEXT NOT NULL CHECK (improvement_type IN (
    'new_code_pattern',
    'new_manifest_pattern',
    'new_env_var_pattern',
    'new_path_signal',
    'threshold_adjustment',
    'confidence_tuning',
    'exclusion_addition'
  )),
  title             TEXT NOT NULL,
  rationale         TEXT NOT NULL,
  proposed_change   JSONB NOT NULL,
  status            TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'approved', 'applied', 'rejected', 'reverted')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at        TIMESTAMPTZ,
  applied_by        TEXT,
  reverted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_learning_improvements_status
  ON learning_improvements (status);

-- --------------------------------------------------------------------------
-- Snapshot of pattern versions over time so we can evaluate the impact of
-- an improvement by re-running stored projects against a known version.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS learning_pattern_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_label   TEXT NOT NULL UNIQUE,
  description     TEXT,
  patterns_json   JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      TEXT
);

-- --------------------------------------------------------------------------
-- Before/after comparison for an improvement. One row per
-- (improvement, project) pair so the trend chart can aggregate.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS learning_scan_comparisons (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  improvement_id      UUID NOT NULL REFERENCES learning_improvements(id) ON DELETE CASCADE,
  project_id          UUID NOT NULL REFERENCES learning_projects(id) ON DELETE CASCADE,
  before_scan_id      UUID NOT NULL REFERENCES learning_scans(id) ON DELETE CASCADE,
  after_scan_id       UUID NOT NULL REFERENCES learning_scans(id) ON DELETE CASCADE,
  before_findings     INTEGER NOT NULL DEFAULT 0,
  after_findings      INTEGER NOT NULL DEFAULT 0,
  new_findings        INTEGER NOT NULL DEFAULT 0,
  lost_findings       INTEGER NOT NULL DEFAULT 0,
  delta_summary       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_scan_comparisons_improvement
  ON learning_scan_comparisons (improvement_id);
