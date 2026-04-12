-- ============================================================================
-- 011_collective_immunity.sql
-- Collective Cybercrime Immunity Network
-- ============================================================================
--
-- Adds the Collective Defense Network feature set to Nexus. This migration
-- creates tables for:
--
--   1.  threat_surface_genomes       – per-org digital attack surface maps
--   2.  threat_behavioral_fingerprints – AI-extracted behavioral attack patterns
--   3.  network_memberships          – Collective Defense Network participation
--   4.  shared_threat_intelligence   – anonymized cross-org threat intel pool
--   5.  attack_predictions           – AI predictions of future targeting
--   6.  countermeasure_deployments   – automated defensive rule deployments
--   7.  threat_events                – threat-specific event tracking
--   8.  individual_profiles          – consumer accounts for individual users
--   9.  threat_reports               – crowdsourced threat reports
--   10. individual_alerts            – proactive alerts pushed to individuals
--
-- Privacy by design: shared_threat_intelligence has NO FK to organizations;
-- contributor identity is protected via HMAC hashing.
-- ============================================================================


-- --------------------------------------------------------------------------
-- 1. threat_surface_genomes
-- Maps each org's digital attack surface.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS threat_surface_genomes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  genome_version        INTEGER NOT NULL DEFAULT 1,
  tech_stack_fingerprint JSONB NOT NULL DEFAULT '{}',
  exposure_profile      JSONB NOT NULL DEFAULT '{}',
  vulnerability_vectors JSONB NOT NULL DEFAULT '[]',
  industry_classification TEXT,
  org_size_tier         TEXT CHECK (org_size_tier IN ('small', 'medium', 'large', 'enterprise')),
  asset_count_tier      TEXT CHECK (asset_count_tier IN ('1-50', '51-200', '201-1000', '1000+')),
  genome_hash           TEXT NOT NULL,
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, genome_version)
);

CREATE INDEX IF NOT EXISTS idx_threat_surface_genomes_org_computed
  ON threat_surface_genomes (org_id, computed_at DESC);


-- --------------------------------------------------------------------------
-- 2. threat_behavioral_fingerprints
-- AI-extracted behavioral patterns of attacks.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS threat_behavioral_fingerprints (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporting_org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fingerprint_type      TEXT NOT NULL CHECK (fingerprint_type IN (
    'bec', 'phishing', 'credential_stuffing', 'supply_chain',
    'insider_threat', 'api_abuse', 'data_exfiltration', 'ransomware',
    'social_engineering', 'investment_scam', 'tech_support_scam',
    'romance_scam', 'unknown'
  )),
  behavioral_signature  JSONB NOT NULL,
  attack_stage          TEXT CHECK (attack_stage IN (
    'reconnaissance', 'delivery', 'exploitation',
    'installation', 'command_control', 'action'
  )),
  confidence            NUMERIC(5,2) NOT NULL DEFAULT 0.0
                          CHECK (confidence >= 0 AND confidence <= 100),
  ioc_count             INTEGER NOT NULL DEFAULT 0,
  first_observed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_observed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  severity              TEXT NOT NULL DEFAULT 'medium'
                          CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'confirmed', 'superseded', 'false_positive')),
  shared_fingerprint_id UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threat_fingerprints_org_created
  ON threat_behavioral_fingerprints (reporting_org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threat_fingerprints_type_severity
  ON threat_behavioral_fingerprints (fingerprint_type, severity);
CREATE INDEX IF NOT EXISTS idx_threat_fingerprints_status
  ON threat_behavioral_fingerprints (status);


-- --------------------------------------------------------------------------
-- 3. network_memberships
-- Tracks which orgs participate in the Collective Defense Network.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS network_memberships (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  status                    TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'active', 'suspended', 'withdrawn')),
  contribution_tier         TEXT NOT NULL DEFAULT 'standard'
                              CHECK (contribution_tier IN ('observer', 'standard', 'contributor', 'anchor')),
  share_threat_fingerprints BOOLEAN NOT NULL DEFAULT true,
  share_genome_profile      BOOLEAN NOT NULL DEFAULT true,
  share_countermeasure_outcomes BOOLEAN NOT NULL DEFAULT false,
  anonymization_level       TEXT NOT NULL DEFAULT 'full'
                              CHECK (anonymization_level IN ('full', 'partial', 'minimal')),
  threats_contributed       INTEGER NOT NULL DEFAULT 0,
  threats_received          INTEGER NOT NULL DEFAULT 0,
  countermeasures_deployed  INTEGER NOT NULL DEFAULT 0,
  reputation_score          NUMERIC(5,2) NOT NULL DEFAULT 50.0,
  joined_at                 TIMESTAMPTZ,
  last_contribution_at      TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- --------------------------------------------------------------------------
-- 4. shared_threat_intelligence
-- Anonymized cross-org threat intelligence pool.
-- NO FK to organizations — privacy by design.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shared_threat_intelligence (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_hash      TEXT NOT NULL,
  fingerprint_type      TEXT NOT NULL,
  behavioral_signature  JSONB NOT NULL,
  attack_stage          TEXT,
  severity              TEXT NOT NULL DEFAULT 'medium',
  confidence            NUMERIC(5,2) NOT NULL DEFAULT 0.0,
  corroboration_count   INTEGER NOT NULL DEFAULT 1,
  first_seen_network_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_network_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  affected_industries   JSONB NOT NULL DEFAULT '[]',
  affected_tech_stacks  JSONB NOT NULL DEFAULT '[]',
  affected_size_tiers   JSONB NOT NULL DEFAULT '[]',
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'confirmed', 'mitigated', 'false_positive')),
  ttl_expires_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_intel_type_severity
  ON shared_threat_intelligence (fingerprint_type, severity);
CREATE INDEX IF NOT EXISTS idx_shared_intel_status_last_seen
  ON shared_threat_intelligence (status, last_seen_network_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_intel_ttl
  ON shared_threat_intelligence (ttl_expires_at) WHERE ttl_expires_at IS NOT NULL;


-- --------------------------------------------------------------------------
-- 5. attack_predictions
-- AI predictions of which orgs will be targeted next.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attack_predictions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_org_id             UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  threat_intel_id           UUID NOT NULL REFERENCES shared_threat_intelligence(id) ON DELETE CASCADE,
  prediction_score          NUMERIC(5,2) NOT NULL
                              CHECK (prediction_score >= 0 AND prediction_score <= 100),
  risk_factors              JSONB NOT NULL DEFAULT '[]',
  predicted_attack_window   JSONB,
  recommended_countermeasures JSONB NOT NULL DEFAULT '[]',
  status                    TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'acknowledged', 'mitigated', 'expired', 'hit', 'miss')),
  notified_at               TIMESTAMPTZ,
  expires_at                TIMESTAMPTZ NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attack_predictions_org_status_score
  ON attack_predictions (target_org_id, status, prediction_score DESC);
CREATE INDEX IF NOT EXISTS idx_attack_predictions_intel
  ON attack_predictions (threat_intel_id);


-- --------------------------------------------------------------------------
-- 6. countermeasure_deployments
-- Tracks automated defensive rule deployments.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS countermeasure_deployments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  threat_intel_id       UUID REFERENCES shared_threat_intelligence(id) ON DELETE SET NULL,
  prediction_id         UUID REFERENCES attack_predictions(id) ON DELETE SET NULL,
  countermeasure_type   TEXT NOT NULL CHECK (countermeasure_type IN (
    'policy_rule', 'alert_escalation', 'quarantine_pattern',
    'access_restriction', 'monitoring_boost', 'network_block', 'custom'
  )),
  policy_id             UUID REFERENCES policies(id) ON DELETE SET NULL,
  deployment_payload    JSONB NOT NULL DEFAULT '{}',
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'deployed', 'active', 'rolled_back', 'expired')),
  auto_deployed         BOOLEAN NOT NULL DEFAULT false,
  deployed_at           TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ,
  rolled_back_at        TIMESTAMPTZ,
  rollback_reason       TEXT,
  effectiveness_score   NUMERIC(5,2),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_countermeasure_deployments_org_status
  ON countermeasure_deployments (org_id, status);
CREATE INDEX IF NOT EXISTS idx_countermeasure_deployments_intel
  ON countermeasure_deployments (threat_intel_id);


-- --------------------------------------------------------------------------
-- 7. threat_events
-- Threat-specific event tracking.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS threat_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fingerprint_id        UUID REFERENCES threat_behavioral_fingerprints(id) ON DELETE SET NULL,
  threat_intel_id       UUID REFERENCES shared_threat_intelligence(id) ON DELETE SET NULL,
  prediction_id         UUID REFERENCES attack_predictions(id) ON DELETE SET NULL,
  deployment_id         UUID REFERENCES countermeasure_deployments(id) ON DELETE SET NULL,
  event_type            TEXT NOT NULL CHECK (event_type IN (
    'threat_detected', 'threat_shared', 'threat_received',
    'threat_corroborated', 'prediction_generated', 'prediction_acknowledged',
    'prediction_hit', 'countermeasure_deployed', 'countermeasure_effective',
    'countermeasure_rolled_back', 'genome_updated', 'network_joined',
    'network_alert'
  )),
  severity              TEXT NOT NULL DEFAULT 'info',
  title                 TEXT NOT NULL,
  body                  TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threat_events_org_created
  ON threat_events (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threat_events_type_created
  ON threat_events (event_type, created_at DESC);


-- --------------------------------------------------------------------------
-- 8. individual_profiles
-- Consumer accounts for individual users.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS individual_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  display_name          TEXT,
  risk_profile          JSONB NOT NULL DEFAULT '{}',
  protection_level      TEXT NOT NULL DEFAULT 'free'
                          CHECK (protection_level IN ('free', 'standard', 'premium')),
  threats_reported      INTEGER NOT NULL DEFAULT 0,
  threats_blocked       INTEGER NOT NULL DEFAULT 0,
  reputation_score      NUMERIC(5,2) NOT NULL DEFAULT 50.0,
  alert_preferences     JSONB NOT NULL DEFAULT '{"email": true, "push": true, "sms": false}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- --------------------------------------------------------------------------
-- 9. threat_reports
-- Crowdsourced threat reports from individuals and organizations.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS threat_reports (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reporter_type             TEXT NOT NULL DEFAULT 'individual'
                              CHECK (reporter_type IN ('individual', 'organization')),
  org_id                    UUID REFERENCES organizations(id) ON DELETE SET NULL,
  report_type               TEXT NOT NULL CHECK (report_type IN (
    'phishing_email', 'scam_text', 'fraud_call', 'fake_website',
    'investment_scam', 'tech_support_scam', 'romance_scam',
    'impersonation', 'malware', 'other'
  )),
  title                     TEXT NOT NULL,
  description               TEXT,
  evidence                  JSONB NOT NULL DEFAULT '{}',
  ai_analysis               JSONB,
  behavioral_fingerprint_id UUID REFERENCES threat_behavioral_fingerprints(id) ON DELETE SET NULL,
  severity                  TEXT NOT NULL DEFAULT 'medium',
  status                    TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'verified', 'rejected', 'duplicate')),
  verification_count        INTEGER NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threat_reports_reporter_created
  ON threat_reports (reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threat_reports_type_status
  ON threat_reports (report_type, status);


-- --------------------------------------------------------------------------
-- 10. individual_alerts
-- Proactive alerts pushed to individual users.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS individual_alerts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  threat_intel_id       UUID REFERENCES shared_threat_intelligence(id) ON DELETE SET NULL,
  threat_report_id      UUID REFERENCES threat_reports(id) ON DELETE SET NULL,
  alert_type            TEXT NOT NULL CHECK (alert_type IN (
    'active_scam', 'trending_threat', 'personal_risk',
    'protection_update', 'community_alert'
  )),
  title                 TEXT NOT NULL,
  body                  TEXT,
  severity              TEXT NOT NULL DEFAULT 'medium',
  action_url            TEXT,
  read_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_individual_alerts_user_read_created
  ON individual_alerts (user_id, read_at, created_at DESC);


-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
DO $$ BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON threat_behavioral_fingerprints
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON network_memberships
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON shared_threat_intelligence
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON countermeasure_deployments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON individual_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE threat_surface_genomes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_behavioral_fingerprints  ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_memberships             ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_threat_intelligence      ENABLE ROW LEVEL SECURITY;
ALTER TABLE attack_predictions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE countermeasure_deployments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_events                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE individual_profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_reports                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE individual_alerts               ENABLE ROW LEVEL SECURITY;


-- --------------------------------------------------------------------------
-- Org-scoped tables: members can SELECT/INSERT/UPDATE/DELETE their own org data
-- --------------------------------------------------------------------------

-- threat_surface_genomes
CREATE POLICY "threat_surface_genomes: org members can select" ON threat_surface_genomes
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
CREATE POLICY "threat_surface_genomes: org members can insert" ON threat_surface_genomes
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
CREATE POLICY "threat_surface_genomes: org members can update" ON threat_surface_genomes
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
CREATE POLICY "threat_surface_genomes: org members can delete" ON threat_surface_genomes
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

-- threat_behavioral_fingerprints
CREATE POLICY "threat_behavioral_fingerprints: org members can select" ON threat_behavioral_fingerprints
  FOR SELECT USING (
    reporting_org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
CREATE POLICY "threat_behavioral_fingerprints: org members can insert" ON threat_behavioral_fingerprints
  FOR INSERT WITH CHECK (
    reporting_org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
CREATE POLICY "threat_behavioral_fingerprints: org members can update" ON threat_behavioral_fingerprints
  FOR UPDATE USING (
    reporting_org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
CREATE POLICY "threat_behavioral_fingerprints: org members can delete" ON threat_behavioral_fingerprints
  FOR DELETE USING (
    reporting_org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

-- network_memberships
CREATE POLICY "network_memberships: org members can select" ON network_memberships
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
CREATE POLICY "network_memberships: org members can insert" ON network_memberships
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
CREATE POLICY "network_memberships: org members can update" ON network_memberships
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
CREATE POLICY "network_memberships: org members can delete" ON network_memberships
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

-- attack_predictions
CREATE POLICY "attack_predictions: org members can select" ON attack_predictions
  FOR SELECT USING (
    target_org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
CREATE POLICY "attack_predictions: org members can insert" ON attack_predictions
  FOR INSERT WITH CHECK (
    target_org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
CREATE POLICY "attack_predictions: org members can update" ON attack_predictions
  FOR UPDATE USING (
    target_org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
CREATE POLICY "attack_predictions: org members can delete" ON attack_predictions
  FOR DELETE USING (
    target_org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

-- countermeasure_deployments
CREATE POLICY "countermeasure_deployments: org members can select" ON countermeasure_deployments
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
CREATE POLICY "countermeasure_deployments: org members can insert" ON countermeasure_deployments
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
CREATE POLICY "countermeasure_deployments: org members can update" ON countermeasure_deployments
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
CREATE POLICY "countermeasure_deployments: org members can delete" ON countermeasure_deployments
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

-- threat_events
CREATE POLICY "threat_events: org members can select" ON threat_events
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
CREATE POLICY "threat_events: org members can insert" ON threat_events
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
CREATE POLICY "threat_events: org members can update" ON threat_events
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
CREATE POLICY "threat_events: org members can delete" ON threat_events
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );


-- --------------------------------------------------------------------------
-- shared_threat_intelligence: read-only for all authenticated users
-- (no direct writes — only through API / service role)
-- --------------------------------------------------------------------------
CREATE POLICY "shared_threat_intelligence: authenticated users can read" ON shared_threat_intelligence
  FOR SELECT TO authenticated USING (true);


-- --------------------------------------------------------------------------
-- Individual / user-scoped tables: users can access their own rows
-- --------------------------------------------------------------------------

-- individual_profiles
CREATE POLICY "individual_profiles: users can select own" ON individual_profiles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "individual_profiles: users can insert own" ON individual_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "individual_profiles: users can update own" ON individual_profiles
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "individual_profiles: users can delete own" ON individual_profiles
  FOR DELETE USING (user_id = auth.uid());

-- threat_reports
CREATE POLICY "threat_reports: users can select own" ON threat_reports
  FOR SELECT USING (reporter_id = auth.uid());
CREATE POLICY "threat_reports: users can insert own" ON threat_reports
  FOR INSERT WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "threat_reports: users can update own" ON threat_reports
  FOR UPDATE USING (reporter_id = auth.uid());
CREATE POLICY "threat_reports: users can delete own" ON threat_reports
  FOR DELETE USING (reporter_id = auth.uid());

-- individual_alerts
CREATE POLICY "individual_alerts: users can select own" ON individual_alerts
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "individual_alerts: users can insert own" ON individual_alerts
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "individual_alerts: users can update own" ON individual_alerts
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "individual_alerts: users can delete own" ON individual_alerts
  FOR DELETE USING (user_id = auth.uid());


-- --------------------------------------------------------------------------
-- Service role: full access to all tables
-- --------------------------------------------------------------------------
CREATE POLICY "Service role full access threat_surface_genomes" ON threat_surface_genomes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access threat_behavioral_fingerprints" ON threat_behavioral_fingerprints
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access network_memberships" ON network_memberships
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access shared_threat_intelligence" ON shared_threat_intelligence
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access attack_predictions" ON attack_predictions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access countermeasure_deployments" ON countermeasure_deployments
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access threat_events" ON threat_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access individual_profiles" ON individual_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access threat_reports" ON threat_reports
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access individual_alerts" ON individual_alerts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
