-- 007_launch_fixes.sql
-- Final launch verification fixes

-- 1. compliance_mappings: make asset_id nullable for org-level assessments
--    Previously: NOT NULL REFERENCES assets(id) ON DELETE CASCADE
--    Fix: drop NOT NULL + FK so org-level control assessments (asset_id = NULL) work
ALTER TABLE compliance_mappings
  ALTER COLUMN asset_id DROP NOT NULL;

ALTER TABLE compliance_mappings
  DROP CONSTRAINT IF EXISTS compliance_mappings_asset_id_fkey;

-- Re-add index (was on NOT NULL column — still useful)
CREATE INDEX IF NOT EXISTS idx_compliance_mappings_asset ON compliance_mappings(asset_id)
  WHERE asset_id IS NOT NULL;

-- 2. org_members: add missing columns for invitation tracking
ALTER TABLE org_members
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id);

-- (invited_at and accepted_at were added in 006, but add IF NOT EXISTS guard)
ALTER TABLE org_members
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;

ALTER TABLE org_members
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- 3. invitations: ensure token index exists (was in 006 but guard with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS invitations_token_idx ON invitations(token);
CREATE INDEX IF NOT EXISTS invitations_org_id_idx ON invitations(org_id);
CREATE INDEX IF NOT EXISTS invitations_email_idx ON invitations(email);

-- 4. assets: add missing columns that the risk/ownership engines write to
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS last_changed_at TIMESTAMPTZ;

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 5. tasks: ensure created_by allows system sentinel UUID
--    The policy engine inserts tasks with created_by = '00000000-...' (system)
--    Remove the FK if it references auth.users (system UUID won't exist there)
ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;

-- 6. hr_employees: ensure table exists for ownership engine cross-reference
CREATE TABLE IF NOT EXISTS hr_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  email TEXT NOT NULL,
  name TEXT,
  department TEXT,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
  manager_email TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  external_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, email)
);

CREATE INDEX IF NOT EXISTS hr_employees_org_id_idx ON hr_employees(org_id);
CREATE INDEX IF NOT EXISTS hr_employees_email_idx ON hr_employees(email);
CREATE INDEX IF NOT EXISTS hr_employees_user_id_idx ON hr_employees(user_id) WHERE user_id IS NOT NULL;

-- RLS for hr_employees
ALTER TABLE hr_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_employees: org members can read" ON hr_employees
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "hr_employees: admins can write" ON hr_employees
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- 7. Add stripe_price_id column to organizations for plan tracking
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';

-- 8. Add sdk_api_key to organizations if missing
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS sdk_api_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_sdk_api_key_idx ON organizations(sdk_api_key)
  WHERE sdk_api_key IS NOT NULL;

-- 9. Ensure alert_preferences has event_filters column (JSONB)
ALTER TABLE alert_preferences
  ADD COLUMN IF NOT EXISTS event_filters JSONB NOT NULL DEFAULT '{}';
