-- Organizations / workspaces
-- Encrypt github_token at rest (pgcrypto) in prod; here stored as text with RLS isolation
CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  github_org text,
  github_token text,
  stripe_customer_id text,
  stripe_sub_id text,
  plan text DEFAULT 'trial',
  scan_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Scans
CREATE TABLE scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces NOT NULL,
  status text DEFAULT 'pending',
  repos_scanned int DEFAULT 0,
  agents_found int DEFAULT 0,
  error_message text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Agents found
CREATE TABLE agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid REFERENCES scans NOT NULL,
  workspace_id uuid REFERENCES workspaces NOT NULL,
  name text NOT NULL,
  repo text NOT NULL,
  file_path text NOT NULL,
  owner_github text,
  owner_email text,
  last_commit_at timestamptz,
  days_since_commit int,
  agent_type text,
  description text,
  risk_level text DEFAULT 'medium',
  risk_reason text,
  services text[],
  has_secrets bool DEFAULT false,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their workspaces" ON workspaces
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Users see their scans" ON scans
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users see their agents" ON agents
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- Performance indexes
CREATE INDEX idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX idx_scans_workspace ON scans(workspace_id);
CREATE INDEX idx_scans_status ON scans(status);
CREATE INDEX idx_agents_workspace ON agents(workspace_id);
CREATE INDEX idx_agents_scan ON agents(scan_id);
CREATE INDEX idx_agents_risk ON agents(risk_level);
CREATE INDEX idx_agents_status ON agents(status);

-- adminClient service-role bypass (insert workspace on signup)
CREATE POLICY "Service role full access workspaces" ON workspaces
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access scans" ON scans
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access agents" ON agents
  FOR ALL TO service_role USING (true) WITH CHECK (true);
