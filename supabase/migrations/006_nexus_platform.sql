-- ============================================================
-- 006_nexus_platform.sql
-- Nexus AI Asset Management Platform — Full Schema
-- ============================================================

-- ORGANIZATIONS (multi-tenant)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','professional','enterprise')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  stripe_subscription_status TEXT,
  trial_ends_at TIMESTAMPTZ,
  max_assets INTEGER NOT NULL DEFAULT 50,
  max_connectors INTEGER NOT NULL DEFAULT 3,
  sdk_api_key TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ORGANIZATION MEMBERS
CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner','admin','operator','viewer')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- INVITATIONS
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','operator','viewer')),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CONNECTORS
CREATE TABLE IF NOT EXISTS connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'github','gitlab','bitbucket','aws','gcp','azure',
    'zapier','n8n','make','rippling','bamboohr','workday',
    'slack','sdk','webhook'
  )),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','error','paused','disconnected')),
  credentials_encrypted TEXT NOT NULL DEFAULT '',
  config JSONB NOT NULL DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_error TEXT,
  last_sync_asset_count INTEGER,
  sync_schedule TEXT NOT NULL DEFAULT '0 */6 * * *',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_connectors_org ON connectors(org_id);
CREATE INDEX IF NOT EXISTS idx_connectors_kind ON connectors(kind);

-- CONNECTOR SYNC HISTORY
CREATE TABLE IF NOT EXISTS connector_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','partial')),
  assets_found INTEGER DEFAULT 0,
  assets_created INTEGER DEFAULT 0,
  assets_updated INTEGER DEFAULT 0,
  assets_removed INTEGER DEFAULT 0,
  error TEXT,
  metadata JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_connector_syncs_connector ON connector_syncs(connector_id);
CREATE INDEX IF NOT EXISTS idx_connector_syncs_org ON connector_syncs(org_id, started_at DESC);

-- AI ASSETS (the core registry)
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connector_id UUID REFERENCES connectors(id) ON DELETE SET NULL,
  external_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL DEFAULT 'unknown' CHECK (kind IN (
    'agent','pipeline','workflow','function','script','model','integration','api','sdk_reported','unknown'
  )),
  source TEXT NOT NULL,
  source_url TEXT,
  environment TEXT NOT NULL DEFAULT 'unknown' CHECK (environment IN ('production','staging','development','unknown')),

  -- Ownership
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_email TEXT,
  owner_status TEXT NOT NULL DEFAULT 'unknown_owner' CHECK (owner_status IN (
    'active_owner','inactive_owner','unknown_owner','orphaned','reassignment_pending','reviewed_unassigned'
  )),
  owner_confidence INTEGER NOT NULL DEFAULT 0 CHECK (owner_confidence BETWEEN 0 AND 100),
  owner_source TEXT,

  -- Risk
  risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high','critical')),
  risk_breakdown JSONB NOT NULL DEFAULT '{}',
  risk_scored_at TIMESTAMPTZ,

  -- Metadata
  ai_services JSONB NOT NULL DEFAULT '[]',
  data_classification JSONB NOT NULL DEFAULT '[]',
  tags JSONB NOT NULL DEFAULT '[]',
  compliance_tags JSONB NOT NULL DEFAULT '[]',

  -- State
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','quarantined','archived','decommissioned')),
  review_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (review_status IN ('unreviewed','in_review','reviewed','flagged')),
  review_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,

  -- Timestamps
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  raw_metadata JSONB NOT NULL DEFAULT '{}',

  UNIQUE(org_id, connector_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_assets_org ON assets(org_id);
CREATE INDEX IF NOT EXISTS idx_assets_risk ON assets(org_id, risk_level, risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_assets_owner ON assets(org_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(org_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_source ON assets(org_id, source);
CREATE INDEX IF NOT EXISTS idx_assets_owner_status ON assets(org_id, owner_status);

-- ASSET CHANGE HISTORY
CREATE TABLE IF NOT EXISTS asset_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  change_type TEXT NOT NULL,
  previous_state JSONB,
  new_state JSONB,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_asset_history_asset ON asset_history(asset_id, created_at DESC);

-- RISK SCORE HISTORY
CREATE TABLE IF NOT EXISTS risk_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  risk_score INTEGER NOT NULL,
  risk_level TEXT NOT NULL,
  risk_breakdown JSONB NOT NULL DEFAULT '{}',
  scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_risk_history_asset ON risk_history(asset_id, scored_at DESC);

-- POLICIES
CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('info','low','medium','high','critical')),
  conditions JSONB NOT NULL DEFAULT '{"operator":"AND","rules":[]}',
  scope JSONB NOT NULL DEFAULT '{}',
  actions JSONB NOT NULL DEFAULT '[]',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  last_run_at TIMESTAMPTZ,
  last_run_violations INTEGER DEFAULT 0,
  dry_run_mode BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_policies_org ON policies(org_id);

-- POLICY VIOLATIONS
CREATE TABLE IF NOT EXISTS policy_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved','suppressed')),
  severity TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_violations_org ON policy_violations(org_id, status);
CREATE INDEX IF NOT EXISTS idx_violations_asset ON policy_violations(asset_id);
CREATE INDEX IF NOT EXISTS idx_violations_policy ON policy_violations(policy_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_violations_unique ON policy_violations(policy_id, asset_id) WHERE status = 'open';

-- EVENTS
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','low','medium','high','critical')),
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  connector_id UUID REFERENCES connectors(id) ON DELETE SET NULL,
  policy_id UUID REFERENCES policies(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_org ON events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_asset ON events(asset_id);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(org_id, kind, created_at DESC);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at, created_at DESC);

-- ALERT DELIVERIES
CREATE TABLE IF NOT EXISTS alert_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  destination TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed','suppressed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_event ON alert_deliveries(event_id);

-- ALERT PREFERENCES
CREATE TABLE IF NOT EXISTS alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  slack_webhook_url TEXT,
  slack_channel TEXT,
  email_recipients JSONB NOT NULL DEFAULT '[]',
  webhook_urls JSONB NOT NULL DEFAULT '[]',
  event_filters JSONB NOT NULL DEFAULT '{}',
  digest_mode BOOLEAN NOT NULL DEFAULT false,
  digest_schedule TEXT DEFAULT '0 9 * * 1',
  suppression_rules JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- COMPLIANCE FRAMEWORKS
CREATE TABLE IF NOT EXISTS compliance_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  version TEXT,
  description TEXT,
  controls JSONB NOT NULL DEFAULT '[]',
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- COMPLIANCE MAPPINGS
CREATE TABLE IF NOT EXISTS compliance_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  framework_id UUID NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
  control_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('compliant','non_compliant','not_applicable','needs_review','unknown')),
  evidence JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  assessed_by UUID REFERENCES auth.users(id),
  assessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, asset_id, framework_id, control_id)
);
CREATE INDEX IF NOT EXISTS idx_compliance_mappings_org ON compliance_mappings(org_id);
CREATE INDEX IF NOT EXISTS idx_compliance_mappings_asset ON compliance_mappings(asset_id);

-- AUDIT LOG
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  actor_id UUID REFERENCES auth.users(id),
  actor_email TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_org ON audit_log(org_id, created_at DESC);

-- TASKS
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  violation_id UUID REFERENCES policy_violations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(org_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_asset ON tasks(asset_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assigned_to, status);

-- UPDATED_AT TRIGGERS
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON connectors FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON policies FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON alert_preferences FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SEED BUILT-IN COMPLIANCE FRAMEWORKS
INSERT INTO compliance_frameworks (id, name, code, version, description, controls, is_builtin, org_id) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  'EU AI Act',
  'eu_ai_act',
  '2024',
  'European Union Artificial Intelligence Act — key governance controls',
  '[
    {"id":"EUAI-ART-9","name":"Risk Management System","description":"Maintain risk management documentation for all high-risk AI systems","category":"risk","required":true},
    {"id":"EUAI-ART-10","name":"Data Governance","description":"AI training data must meet quality criteria and governance requirements","category":"data","required":true},
    {"id":"EUAI-ART-11","name":"Technical Documentation","description":"Maintain technical documentation for each AI system before placing on market","category":"documentation","required":true},
    {"id":"EUAI-ART-12","name":"Record Keeping","description":"Automatic logging of events for high-risk AI systems","category":"logging","required":true},
    {"id":"EUAI-ART-13","name":"Transparency","description":"AI systems must be interpretable and explainable to users","category":"transparency","required":true},
    {"id":"EUAI-ART-14","name":"Human Oversight","description":"Human oversight mechanisms must be built into AI systems","category":"oversight","required":true},
    {"id":"EUAI-ART-17","name":"Quality Management","description":"Quality management system must be established for high-risk AI","category":"governance","required":true}
  ]'::jsonb,
  true,
  NULL
),
(
  '00000000-0000-0000-0000-000000000002',
  'SOC 2 AI Controls',
  'soc2_ai',
  '2023',
  'SOC 2 controls relevant to AI system management',
  '[
    {"id":"CC6.6","name":"Logical Access Controls","description":"AI systems implement logical access restrictions and least-privilege","category":"access","required":true},
    {"id":"CC7.1","name":"System Operations","description":"AI systems are monitored for anomalies and unauthorized activity","category":"monitoring","required":true},
    {"id":"CC7.2","name":"Security Incidents","description":"AI-related security incidents are identified, tracked, and remediated","category":"incidents","required":true},
    {"id":"CC8.1","name":"Change Management","description":"AI system changes follow documented change management processes","category":"change","required":true},
    {"id":"A1.2","name":"Availability","description":"AI system availability is monitored and documented with SLAs","category":"availability","required":false}
  ]'::jsonb,
  true,
  NULL
),
(
  '00000000-0000-0000-0000-000000000003',
  'ISO/IEC 42001:2023',
  'iso42001',
  '2023',
  'International standard for AI management systems',
  '[
    {"id":"4.1","name":"Context of the Organization","description":"Understand internal and external context for AI system deployment","category":"context","required":true},
    {"id":"5.2","name":"AI Policy","description":"Top management establishes and communicates AI policy","category":"governance","required":true},
    {"id":"6.1","name":"Risk Assessment","description":"AI risks are systematically identified and assessed","category":"risk","required":true},
    {"id":"8.4","name":"AI System Impact Assessment","description":"Impact assessment performed before deploying AI systems","category":"impact","required":true},
    {"id":"9.1","name":"Monitoring and Measurement","description":"AI systems are monitored against defined objectives","category":"monitoring","required":true},
    {"id":"10.2","name":"Nonconformity and Corrective Action","description":"Nonconformities are corrected and root causes addressed","category":"remediation","required":true}
  ]'::jsonb,
  true,
  NULL
),
(
  '00000000-0000-0000-0000-000000000004',
  'NIST AI Risk Management Framework',
  'nist_ai_rmf',
  '1.0',
  'NIST AI RMF — Govern, Map, Measure, Manage',
  '[
    {"id":"GOVERN-1","name":"Governance Policies","description":"AI risk governance policies and accountability are established","category":"govern","required":true},
    {"id":"GOVERN-2","name":"AI Accountability","description":"Organizational roles and responsibilities for AI are defined","category":"govern","required":true},
    {"id":"MAP-1","name":"AI Context","description":"Organizational context for AI risk is identified and mapped","category":"map","required":true},
    {"id":"MAP-3","name":"AI Categorization","description":"AI systems are categorized by use case, risk, and impact","category":"map","required":true},
    {"id":"MEASURE-2","name":"Risk Measurement","description":"AI risks are measured, documented, and tracked over time","category":"measure","required":true},
    {"id":"MANAGE-1","name":"Risk Response","description":"Identified risks are prioritized and responded to appropriately","category":"manage","required":true},
    {"id":"MANAGE-3","name":"Remediation","description":"Identified risks have documented remediation plans","category":"manage","required":true}
  ]'::jsonb,
  true,
  NULL
)
ON CONFLICT (id) DO NOTHING;
