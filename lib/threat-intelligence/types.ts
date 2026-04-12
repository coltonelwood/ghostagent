// ============================================================
// Collective Cybercrime Immunity Network — Types
// ============================================================

import type { Severity } from '../types/platform';

// ---- Threat Surface Genome ----

export interface TechStackFingerprint {
  languages: string[];
  frameworks: string[];
  cloud_providers: string[];
  ai_providers: string[];
  automation_tools: string[];
  hr_systems: string[];
}

export interface ExposureProfile {
  public_apis: number;
  production_assets: number;
  staging_assets: number;
  data_classifications: string[];
  external_integrations: number;
}

export interface VulnerabilityVector {
  vector_id: string;
  name: string;
  susceptibility_score: number;
  factors: string[];
}

export interface ThreatSurfaceGenome {
  id: string;
  org_id: string;
  genome_version: number;
  tech_stack_fingerprint: TechStackFingerprint;
  exposure_profile: ExposureProfile;
  vulnerability_vectors: VulnerabilityVector[];
  industry_classification: string | null;
  org_size_tier: 'small' | 'medium' | 'large' | 'enterprise';
  asset_count_tier: '1-50' | '51-200' | '201-1000' | '1000+';
  genome_hash: string;
  computed_at: string;
}

// ---- Behavioral Fingerprints ----

export type FingerprintType =
  | 'bec' | 'phishing' | 'credential_stuffing' | 'supply_chain'
  | 'insider_threat' | 'api_abuse' | 'data_exfiltration' | 'ransomware'
  | 'social_engineering' | 'investment_scam' | 'tech_support_scam'
  | 'romance_scam' | 'unknown';

export type AttackStage =
  | 'reconnaissance' | 'delivery' | 'exploitation'
  | 'installation' | 'command_control' | 'action';

export interface TTP {
  tactic: string;
  technique: string;
  procedure: string;
  mitre_id?: string;
}

export interface Pattern {
  type: string;
  description: string;
  indicators: string[];
  confidence: number;
}

export interface BehavioralSignature {
  tactics: TTP[];
  communication_patterns: Pattern[];
  temporal_patterns: Pattern[];
  evasion_techniques: string[];
  target_selection_criteria: string[];
  payload_characteristics: string[];
}

export type FingerprintStatus = 'active' | 'confirmed' | 'superseded' | 'false_positive';

export interface BehavioralFingerprint {
  id: string;
  reporting_org_id: string;
  fingerprint_type: FingerprintType;
  behavioral_signature: BehavioralSignature;
  attack_stage: AttackStage | null;
  confidence: number;
  ioc_count: number;
  first_observed_at: string;
  last_observed_at: string;
  severity: Severity;
  status: FingerprintStatus;
  shared_fingerprint_id: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Network Membership ----

export type MembershipStatus = 'pending' | 'active' | 'suspended' | 'withdrawn';
export type ContributionTier = 'observer' | 'standard' | 'contributor' | 'anchor';
export type AnonymizationLevel = 'full' | 'partial' | 'minimal';

export interface NetworkMembership {
  id: string;
  org_id: string;
  status: MembershipStatus;
  contribution_tier: ContributionTier;
  share_threat_fingerprints: boolean;
  share_genome_profile: boolean;
  share_countermeasure_outcomes: boolean;
  anonymization_level: AnonymizationLevel;
  threats_contributed: number;
  threats_received: number;
  countermeasures_deployed: number;
  reputation_score: number;
  joined_at: string | null;
  last_contribution_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Shared Threat Intelligence ----

export type IntelStatus = 'active' | 'confirmed' | 'mitigated' | 'false_positive';

export interface SharedThreatIntel {
  id: string;
  contributor_hash: string;
  fingerprint_type: FingerprintType;
  behavioral_signature: BehavioralSignature;
  attack_stage: AttackStage | null;
  severity: Severity;
  confidence: number;
  corroboration_count: number;
  first_seen_network_at: string;
  last_seen_network_at: string;
  affected_industries: string[];
  affected_tech_stacks: string[];
  affected_size_tiers: string[];
  status: IntelStatus;
  ttl_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Attack Predictions ----

export type PredictionStatus = 'pending' | 'acknowledged' | 'mitigated' | 'expired' | 'hit' | 'miss';

export interface RiskFactor {
  factor: string;
  weight: number;
  explanation: string;
}

export interface AttackWindow {
  earliest: string;
  latest: string;
  confidence: number;
}

export interface RecommendedCountermeasure {
  type: CountermeasureType;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  auto_deployable: boolean;
}

export interface AttackPrediction {
  id: string;
  target_org_id: string;
  threat_intel_id: string;
  prediction_score: number;
  risk_factors: RiskFactor[];
  predicted_attack_window: AttackWindow | null;
  recommended_countermeasures: RecommendedCountermeasure[];
  status: PredictionStatus;
  notified_at: string | null;
  expires_at: string;
  created_at: string;
  // Joined
  threat_intel?: SharedThreatIntel;
}

// ---- Countermeasure Deployments ----

export type CountermeasureType =
  | 'policy_rule' | 'alert_escalation' | 'quarantine_pattern'
  | 'access_restriction' | 'monitoring_boost' | 'network_block' | 'custom';

export type DeploymentStatus = 'pending' | 'deployed' | 'active' | 'rolled_back' | 'expired';

export interface CountermeasureDeployment {
  id: string;
  org_id: string;
  threat_intel_id: string | null;
  prediction_id: string | null;
  countermeasure_type: CountermeasureType;
  policy_id: string | null;
  deployment_payload: Record<string, unknown>;
  status: DeploymentStatus;
  auto_deployed: boolean;
  deployed_at: string | null;
  expires_at: string | null;
  rolled_back_at: string | null;
  rollback_reason: string | null;
  effectiveness_score: number | null;
  created_at: string;
  updated_at: string;
  // Joined
  prediction?: AttackPrediction;
}

// ---- Threat Events ----

export type ThreatEventType =
  | 'threat_detected' | 'threat_shared' | 'threat_received' | 'threat_corroborated'
  | 'prediction_generated' | 'prediction_acknowledged' | 'prediction_hit'
  | 'countermeasure_deployed' | 'countermeasure_effective' | 'countermeasure_rolled_back'
  | 'genome_updated' | 'network_joined' | 'network_alert';

export interface ThreatEvent {
  id: string;
  org_id: string;
  fingerprint_id: string | null;
  threat_intel_id: string | null;
  prediction_id: string | null;
  deployment_id: string | null;
  event_type: ThreatEventType;
  severity: Severity;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ---- Consumer / Individual ----

export type ProtectionLevel = 'free' | 'standard' | 'premium';

export interface IndividualProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  risk_profile: Record<string, unknown>;
  protection_level: ProtectionLevel;
  threats_reported: number;
  threats_blocked: number;
  reputation_score: number;
  alert_preferences: { email: boolean; push: boolean; sms: boolean };
  created_at: string;
  updated_at: string;
}

export type ReportType =
  | 'phishing_email' | 'scam_text' | 'fraud_call' | 'fake_website'
  | 'investment_scam' | 'tech_support_scam' | 'romance_scam'
  | 'impersonation' | 'malware' | 'other';

export type ReportStatus = 'pending' | 'verified' | 'rejected' | 'duplicate';

export interface ThreatReportEvidence {
  raw_content?: string;
  sender?: string;
  urls?: string[];
  phone_numbers?: string[];
  screenshots?: string[];
}

export interface ThreatReport {
  id: string;
  reporter_id: string;
  reporter_type: 'individual' | 'organization';
  org_id: string | null;
  report_type: ReportType;
  title: string;
  description: string | null;
  evidence: ThreatReportEvidence;
  ai_analysis: Record<string, unknown> | null;
  behavioral_fingerprint_id: string | null;
  severity: Severity;
  status: ReportStatus;
  verification_count: number;
  created_at: string;
}

export type AlertType =
  | 'active_scam' | 'trending_threat' | 'personal_risk'
  | 'protection_update' | 'community_alert';

export interface IndividualAlert {
  id: string;
  user_id: string;
  threat_intel_id: string | null;
  threat_report_id: string | null;
  alert_type: AlertType;
  title: string;
  body: string | null;
  severity: Severity;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
}

// ---- Network Stats (anonymized) ----

export interface NetworkStats {
  total_members: number;
  threats_shared_this_week: number;
  predictions_generated: number;
  countermeasures_deployed: number;
  avg_response_time_seconds: number;
  top_threat_types: Array<{ type: FingerprintType; count: number }>;
}

// ---- Threat Observation (input for AI fingerprint extraction) ----

export interface ThreatObservation {
  type: FingerprintType;
  indicators: string[];
  timeline: string;
  affected_assets?: string[];
  narrative: string;
  raw_evidence?: string;
  severity?: Severity;
}

// ---- API Request / Response Shapes ----

export interface CreateThreatReportRequest {
  report_type: ReportType;
  title: string;
  description?: string;
  evidence: ThreatReportEvidence;
}

export interface ReportThreatRequest {
  type: FingerprintType;
  indicators: string[];
  timeline: string;
  affected_asset_ids?: string[];
  narrative: string;
  severity?: Severity;
}

export interface JoinNetworkRequest {
  contribution_tier?: ContributionTier;
  share_threat_fingerprints?: boolean;
  share_genome_profile?: boolean;
  anonymization_level?: AnonymizationLevel;
}

export interface UpdateNetworkPreferencesRequest {
  contribution_tier?: ContributionTier;
  share_threat_fingerprints?: boolean;
  share_genome_profile?: boolean;
  share_countermeasure_outcomes?: boolean;
  anonymization_level?: AnonymizationLevel;
}

export interface DeployCountermeasureRequest {
  auto_deploy?: boolean;
  countermeasure_type?: CountermeasureType;
}

export interface CreateIndividualProfileRequest {
  display_name?: string;
  risk_profile?: Record<string, unknown>;
}

// ---- Consumer Stats ----

export interface ConsumerStats {
  threats_reported: number;
  threats_blocked: number;
  people_protected: number;
  protection_score: number;
  active_alerts: number;
}
