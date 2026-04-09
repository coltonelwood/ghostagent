-- TOCTOU race fix: enforce at DB level that only one active scan per workspace exists
-- A partial UNIQUE constraint prevents concurrent INSERTs for the same workspace
-- when both are in an active state.
--
-- Postgres UNIQUE indexes on expressions with WHERE clauses enforce this atomically.
-- This replaces the application-level check-then-insert pattern.

-- First remove the old non-unique partial index from migration 002
DROP INDEX IF EXISTS idx_scans_workspace_running;

-- Create a proper unique constraint: at most one row per workspace in active status
-- We use a function-based approach since UNIQUE WHERE only works on static values
-- Alternative: use a separate "active_scan" table with UNIQUE(workspace_id)

CREATE UNIQUE INDEX idx_scans_one_active_per_workspace
  ON scans(workspace_id)
  WHERE status IN ('pending', 'scanning', 'classifying');

-- Now when two concurrent requests try to INSERT with status='pending' for the same
-- workspace_id, Postgres will reject the second one with a unique violation (23505).
-- The application code catches this and returns 409 Conflict.
