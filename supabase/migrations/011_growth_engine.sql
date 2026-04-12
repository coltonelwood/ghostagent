-- ============================================================================
-- Growth Automation Engine
-- ============================================================================
--
-- Tables that power the automated revenue engine: lead tracking, onboarding
-- funnel events, trial lifecycle management, and usage-based upsell triggers.
--
-- These tables work alongside the existing organizations / org_members schema
-- to automate the full signup → trial → conversion → expansion lifecycle
-- with minimal human intervention (~5% touch for enterprise deals).
-- ============================================================================

-- --------------------------------------------------------------------------
-- Onboarding funnel events — tracks every step a user takes so we can
-- identify drop-off points and trigger automated recovery sequences.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onboarding_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  event           TEXT NOT NULL CHECK (event IN (
    'signup_completed',
    'org_created',
    'connector_added',
    'first_sync_started',
    'first_sync_completed',
    'first_assets_discovered',
    'team_invited',
    'onboarding_completed',
    'first_compliance_report_viewed',
    'first_policy_created',
    'demo_viewed'
  )),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_org
  ON onboarding_events (org_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_event
  ON onboarding_events (event);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_created
  ON onboarding_events (created_at);

-- --------------------------------------------------------------------------
-- Lead scoring — maintains a computed score for each org based on their
-- engagement signals. Updated by the growth engine after each event.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  score           INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  grade           TEXT NOT NULL DEFAULT 'cold' CHECK (grade IN ('cold', 'warm', 'hot', 'on_fire')),
  signals         JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_activity   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_scores_grade
  ON lead_scores (grade);
CREATE INDEX IF NOT EXISTS idx_lead_scores_score
  ON lead_scores (score DESC);

-- --------------------------------------------------------------------------
-- Email sequence tracking — records which automated emails have been sent
-- to prevent duplicates and enable sequence-aware follow-ups.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_sequences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_email      TEXT NOT NULL,
  sequence        TEXT NOT NULL CHECK (sequence IN (
    'welcome',
    'onboarding_incomplete',
    'first_scan_results',
    'trial_day_3',
    'trial_day_7',
    'trial_day_10',
    'trial_expiring',
    'trial_expired',
    'usage_milestone',
    'upgrade_nudge',
    'reactivation'
  )),
  step            INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'opened', 'clicked', 'converted')),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,
  converted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_sequences_org
  ON email_sequences (org_id);
CREATE INDEX IF NOT EXISTS idx_email_sequences_sequence
  ON email_sequences (sequence);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_sequences_dedup
  ON email_sequences (org_id, sequence, step);

-- --------------------------------------------------------------------------
-- Usage milestones — tracks when an org crosses usage thresholds that
-- trigger upsell prompts or automated upgrade nudges.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_milestones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  milestone       TEXT NOT NULL CHECK (milestone IN (
    'assets_25',
    'assets_100',
    'assets_250',
    'assets_500',
    'connectors_2',
    'connectors_3',
    'connectors_5',
    'first_policy',
    'first_compliance_report',
    'first_violation_resolved',
    'team_size_3',
    'team_size_5',
    'daily_active_3_days',
    'daily_active_7_days'
  )),
  reached_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified        BOOLEAN NOT NULL DEFAULT FALSE,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_milestones_dedup
  ON usage_milestones (org_id, milestone);

-- --------------------------------------------------------------------------
-- Add trial lifecycle fields to organizations if not present
-- --------------------------------------------------------------------------
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_scan_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lead_source TEXT,
  ADD COLUMN IF NOT EXISTS conversion_status TEXT NOT NULL DEFAULT 'trial'
    CHECK (conversion_status IN ('trial', 'active', 'churned', 'expired'));

CREATE INDEX IF NOT EXISTS idx_organizations_trial_ends
  ON organizations (trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_conversion
  ON organizations (conversion_status);
