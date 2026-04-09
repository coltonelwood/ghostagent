-- 008_scanner_learning.sql
-- Continuous learning system for the AI scanner

-- Pattern performance tracking (updated by feedback + scan results)
CREATE TABLE IF NOT EXISTS scanner_pattern_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL UNIQUE,
  total_hits INTEGER NOT NULL DEFAULT 0,
  confirmed_hits INTEGER NOT NULL DEFAULT 0,    -- user marked as valid
  dismissed_hits INTEGER NOT NULL DEFAULT 0,    -- user marked as false positive
  escalated_hits INTEGER NOT NULL DEFAULT 0,    -- user escalated risk level
  precision FLOAT NOT NULL DEFAULT 0.0,         -- confirmed / total (0-1)
  suppressed BOOLEAN NOT NULL DEFAULT false,    -- auto-suppressed if precision < 0.1
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scanner_pattern_stats_query_idx ON scanner_pattern_stats(query);
CREATE INDEX IF NOT EXISTS scanner_pattern_stats_suppressed_idx ON scanner_pattern_stats(suppressed);
CREATE INDEX IF NOT EXISTS scanner_pattern_stats_precision_idx ON scanner_pattern_stats(precision DESC);

-- Scan-level metrics for trend analysis
CREATE TABLE IF NOT EXISTS scanner_scan_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,
  scan_id UUID,
  total_found INTEGER NOT NULL DEFAULT 0,
  by_class JSONB NOT NULL DEFAULT '{}',
  by_risk JSONB NOT NULL DEFAULT '{}',
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scanner_scan_metrics_org_idx ON scanner_scan_metrics(org_id);
CREATE INDEX IF NOT EXISTS scanner_scan_metrics_scanned_at_idx ON scanner_scan_metrics(scanned_at DESC);

-- User feedback on agent findings (drives learning)
CREATE TABLE IF NOT EXISTS scanner_agent_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL,
  agent_id UUID NOT NULL,
  org_id UUID,
  pattern_query TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('confirmed', 'dismissed', 'escalated')),
  user_note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scanner_agent_feedback_scan_idx ON scanner_agent_feedback(scan_id);
CREATE INDEX IF NOT EXISTS scanner_agent_feedback_pattern_idx ON scanner_agent_feedback(pattern_query);
