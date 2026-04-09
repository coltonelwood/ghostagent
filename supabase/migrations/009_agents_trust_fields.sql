-- 009_agents_trust_fields.sql
-- Add investor-grade trust fields to agent findings

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS why_flagged TEXT,
  ADD COLUMN IF NOT EXISTS confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  ADD COLUMN IF NOT EXISTS detection_class TEXT,
  ADD COLUMN IF NOT EXISTS compliance_tags TEXT[] NOT NULL DEFAULT '{}';

-- Index for filtering by compliance tags and detection class
CREATE INDEX IF NOT EXISTS agents_detection_class_idx ON agents(detection_class);
CREATE INDEX IF NOT EXISTS agents_confidence_score_idx ON agents(confidence_score DESC);
