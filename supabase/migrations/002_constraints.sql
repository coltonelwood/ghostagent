-- Prevent duplicate agent records for same file in same scan
CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_scan_file
  ON agents(scan_id, repo, file_path);

-- Partial index: only one running scan per workspace at a time
-- Enforced in application code + this helps query performance
CREATE INDEX IF NOT EXISTS idx_scans_workspace_running
  ON scans(workspace_id, status)
  WHERE status IN ('pending', 'scanning', 'classifying');

-- Prevent multiple workspaces for the same owner (one workspace per user MVP)
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_owner
  ON workspaces(owner_id);

-- Stripe customer ID must be unique if set
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_stripe_customer
  ON workspaces(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
