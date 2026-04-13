-- =========================================================================
-- GhostAgent Operator Layer — Schema Design
-- DO NOT RUN THIS MIGRATION until the business has 10+ customers
-- =========================================================================
--
-- Purpose: Internal autonomous operator for Spekris SaaS
-- Tables: 11 new tables, all org-scoped, additive only
-- Author: GhostAgent Architect
-- Date: 2026-04-12
-- Status: DESIGNED, NOT DEPLOYED
--
-- Prerequisites before deploying:
--   - 10+ paying customers
--   - 2+ team members
--   - Measurable traffic to experiment on
--   - Operational need for task orchestration
--
-- =========================================================================

-- 1. AGENT DEFINITIONS
-- Defines the available internal agent roles and their capabilities
CREATE TABLE IF NOT EXISTS operator_agent_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  capabilities JSONB NOT NULL DEFAULT '[]',
  config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, slug)
);

-- 2. OBJECTIVES
-- High-level goals the operator is working toward
CREATE TABLE IF NOT EXISTS operator_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('activation','conversion','retention','reliability','growth','revenue','product')),
  target_metric TEXT NOT NULL,
  target_value TEXT NOT NULL,
  current_value TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','abandoned')),
  reason TEXT,
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 3. TASKS
-- Scoped work items created by the planner
CREATE TABLE IF NOT EXISTS operator_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  objective_id UUID REFERENCES operator_objectives(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  agent_role TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 50 CHECK (priority BETWEEN 1 AND 100),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','assigned','in_progress','blocked','completed','failed','cancelled')),
  acceptance_criteria JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  assigned_to UUID REFERENCES operator_agent_definitions(id) ON DELETE SET NULL
);

-- 4. TASK DEPENDENCIES
-- DAG edges between tasks
CREATE TABLE IF NOT EXISTS operator_task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES operator_tasks(id) ON DELETE CASCADE,
  depends_on UUID NOT NULL REFERENCES operator_tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, depends_on),
  CHECK(task_id != depends_on)
);

-- 5. TASK RUNS
-- Execution log for each task attempt
CREATE TABLE IF NOT EXISTS operator_task_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES operator_tasks(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','cancelled')),
  input JSONB NOT NULL DEFAULT '{}',
  output JSONB,
  error TEXT,
  duration_ms INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 6. CODE CHANGES
-- Tracks code modifications made by builder agents
CREATE TABLE IF NOT EXISTS operator_code_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_run_id UUID REFERENCES operator_task_runs(id) ON DELETE SET NULL,
  files_changed JSONB NOT NULL DEFAULT '[]',
  commit_sha TEXT,
  branch TEXT,
  summary TEXT,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected','reverted')),
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. VALIDATIONS
-- Review results from the reviewer agent
CREATE TABLE IF NOT EXISTS operator_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_run_id UUID REFERENCES operator_task_runs(id) ON DELETE SET NULL,
  code_change_id UUID REFERENCES operator_code_changes(id) ON DELETE SET NULL,
  decision TEXT NOT NULL CHECK (decision IN ('pass','fail','escalate')),
  confidence INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  blocking_issues JSONB NOT NULL DEFAULT '[]',
  non_blocking_issues JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. EXPERIMENTS
-- A/B tests and feature experiments
CREATE TABLE IF NOT EXISTS operator_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  metric TEXT NOT NULL,
  variant_a TEXT NOT NULL DEFAULT 'control',
  variant_b TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','running','paused','completed','abandoned')),
  traffic_pct INTEGER NOT NULL DEFAULT 50 CHECK (traffic_pct BETWEEN 1 AND 100),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. EXPERIMENT RESULTS
-- Daily metric snapshots per experiment variant
CREATE TABLE IF NOT EXISTS operator_experiment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES operator_experiments(id) ON DELETE CASCADE,
  variant TEXT NOT NULL,
  date DATE NOT NULL,
  sample_size INTEGER NOT NULL DEFAULT 0,
  metric_value NUMERIC,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(experiment_id, variant, date)
);

-- 10. COMPANY METRICS DAILY
-- Daily business health snapshot
CREATE TABLE IF NOT EXISTS operator_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  mrr_cents INTEGER NOT NULL DEFAULT 0,
  total_users INTEGER NOT NULL DEFAULT 0,
  active_users INTEGER NOT NULL DEFAULT 0,
  paying_customers INTEGER NOT NULL DEFAULT 0,
  total_assets INTEGER NOT NULL DEFAULT 0,
  total_connectors INTEGER NOT NULL DEFAULT 0,
  connector_success_rate NUMERIC,
  signup_count INTEGER NOT NULL DEFAULT 0,
  activation_count INTEGER NOT NULL DEFAULT 0,
  churn_count INTEGER NOT NULL DEFAULT 0,
  compliance_score INTEGER,
  deploy_count INTEGER NOT NULL DEFAULT 0,
  incident_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, date)
);

-- 11. INCIDENTS
-- Production issues and their resolution
CREATE TABLE IF NOT EXISTS operator_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','mitigating','resolved','closed')),
  description TEXT,
  root_cause TEXT,
  resolution TEXT,
  affected_systems JSONB NOT NULL DEFAULT '[]',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- INDEXES
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_operator_objectives_org ON operator_objectives(org_id);
CREATE INDEX IF NOT EXISTS idx_operator_tasks_org ON operator_tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_operator_tasks_objective ON operator_tasks(objective_id);
CREATE INDEX IF NOT EXISTS idx_operator_tasks_status ON operator_tasks(org_id, status);
CREATE INDEX IF NOT EXISTS idx_operator_task_runs_task ON operator_task_runs(task_id);
CREATE INDEX IF NOT EXISTS idx_operator_task_runs_org ON operator_task_runs(org_id);
CREATE INDEX IF NOT EXISTS idx_operator_code_changes_org ON operator_code_changes(org_id);
CREATE INDEX IF NOT EXISTS idx_operator_validations_org ON operator_validations(org_id);
CREATE INDEX IF NOT EXISTS idx_operator_experiments_org ON operator_experiments(org_id);
CREATE INDEX IF NOT EXISTS idx_operator_metrics_daily_org ON operator_metrics_daily(org_id, date);
CREATE INDEX IF NOT EXISTS idx_operator_incidents_org ON operator_incidents(org_id);
CREATE INDEX IF NOT EXISTS idx_operator_incidents_status ON operator_incidents(org_id, status);

-- =========================================================================
-- SEED DATA — Agent definitions
-- =========================================================================
-- Uncomment when deploying:
--
-- INSERT INTO operator_agent_definitions (org_id, slug, display_name, description, capabilities) VALUES
-- (NULL, 'planner', 'Planner', 'Creates objectives and scoped tasks', '["read_metrics","create_objectives","create_tasks","assign_tasks"]'),
-- (NULL, 'product_manager', 'Product Manager', 'Converts tasks into implementation specs', '["read_tasks","create_specs","read_architecture"]'),
-- (NULL, 'frontend_builder', 'Frontend Builder', 'Writes production frontend code', '["read_specs","write_code","run_tests"]'),
-- (NULL, 'backend_builder', 'Backend Builder', 'Writes production backend code', '["read_specs","write_code","run_tests","write_migrations"]'),
-- (NULL, 'data_builder', 'Data Builder', 'Designs schemas and migrations', '["read_specs","write_migrations","read_schema"]'),
-- (NULL, 'reviewer', 'Reviewer', 'Reviews and approves changes', '["read_code","read_specs","approve","reject","escalate"]'),
-- (NULL, 'growth_operator', 'Growth Operator', 'Manages outreach and content', '["read_metrics","create_content","manage_campaigns"]'),
-- (NULL, 'revenue_ops', 'Revenue Ops', 'Manages pricing and billing', '["read_metrics","update_pricing","manage_billing"]');
