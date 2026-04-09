// ============================================================
// Nexus Platform — Core Types
// ============================================================

// ---- Organizations & Members ----

export type OrgRole = 'owner' | 'admin' | 'operator' | 'viewer';
export type OrgPlan = 'starter' | 'professional' | 'enterprise';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: OrgPlan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_status: string | null;
  trial_ends_at: string | null;
  max_assets: number;
  max_connectors: number;
  sdk_api_key: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: OrgRole;
  invited_by: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  created_at: string;
  // Joined
  user?: { email: string; user_metadata?: { full_name?: string; avatar_url?: string } };
}

export interface Invitation {
  id: string;
  org_id: string;
  email: string;
  role: OrgRole;
  token: string;
  invited_by: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

// ---- Connectors ----

export type ConnectorKind =
  | 'github' | 'gitlab' | 'bitbucket'
  | 'aws' | 'gcp' | 'azure'
  | 'zapier' | 'n8n' | 'make'
  | 'rippling' | 'bamboohr' | 'workday'
  | 'slack' | 'sdk' | 'webhook';

export type ConnectorCategory = 'code' | 'cloud' | 'automation' | 'hr' | 'internal';
export type ConnectorStatus = 'pending' | 'active' | 'error' | 'paused' | 'disconnected';

export interface Connector {
  id: string;
  org_id: string;
  kind: ConnectorKind;
  name: string;
  status: ConnectorStatus;
  credentials_encrypted: string;
  config: Record<string, unknown>;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  last_sync_asset_count: number | null;
  sync_schedule: string;
  enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ConnectorSync {
  id: string;
  connector_id: string;
  org_id: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed' | 'partial';
  assets_found: number;
  assets_created: number;
  assets_updated: number;
  assets_removed: number;
  error: string | null;
  metadata: Record<string, unknown>;
}

export interface ConnectorDefinition {
  kind: ConnectorKind;
  displayName: string;
  description: string;
  category: ConnectorCategory;
  icon: string;
  authType: 'token' | 'key+secret' | 'oauth' | 'url+key' | 'json';
  fields: ConnectorField[];
  configFields?: ConnectorField[];
}

export interface ConnectorField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'textarea';
  required: boolean;
  placeholder?: string;
  description?: string;
}

// ---- Assets ----

export type AssetKind =
  | 'agent' | 'pipeline' | 'workflow' | 'function'
  | 'script' | 'model' | 'integration' | 'api'
  | 'sdk_reported' | 'unknown';

export type AssetStatus = 'active' | 'inactive' | 'quarantined' | 'archived' | 'decommissioned';
export type ReviewStatus = 'unreviewed' | 'in_review' | 'reviewed' | 'flagged';
export type OwnerStatus =
  | 'active_owner' | 'inactive_owner' | 'unknown_owner'
  | 'orphaned' | 'reassignment_pending' | 'reviewed_unassigned';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AIService {
  provider: string;
  model?: string;
  purpose?: string;
}

export interface RiskDimensionBreakdown {
  score: number;
  weight: number;
  explanation: string;
}

export type Environment = 'production' | 'staging' | 'development' | 'unknown';

export interface Asset {
  id: string;
  org_id: string;
  connector_id: string | null;
  external_id: string | null;
  name: string;
  description: string | null;
  kind: AssetKind;
  source: string;
  source_url: string | null;
  environment: Environment;
  owner_id: string | null;
  owner_email: string | null;
  owner_status: OwnerStatus;
  owner_confidence: number;
  owner_source: string | null;
  risk_score: number;
  risk_level: RiskLevel;
  risk_breakdown: Record<string, RiskDimensionBreakdown>;
  risk_scored_at: string | null;
  ai_services: AIService[];
  data_classification: string[];
  tags: string[];
  compliance_tags: string[];
  status: AssetStatus;
  review_status: ReviewStatus;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  last_changed_at: string;
  created_at: string;
  updated_at: string;
  raw_metadata: Record<string, unknown>;
}

export interface AssetHistory {
  id: string;
  asset_id: string;
  org_id: string;
  changed_by: string | null;
  change_type: string;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  note: string | null;
  created_at: string;
}

export interface RiskHistory {
  id: string;
  asset_id: string;
  org_id: string;
  risk_score: number;
  risk_level: RiskLevel;
  risk_breakdown: Record<string, RiskDimensionBreakdown>;
  scored_at: string;
}

export interface OwnershipHistory {
  id: string;
  asset_id: string;
  org_id: string;
  previous_owner_id: string | null;
  previous_owner_email: string | null;
  new_owner_id: string | null;
  new_owner_email: string | null;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
}

// ---- Policies ----

export type PolicySeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface PolicyRule {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'is_null' | 'is_not_null';
  value: unknown;
}

export interface PolicyConditionGroup {
  operator: 'AND' | 'OR';
  rules: Array<PolicyRule | PolicyConditionGroup>;
}

/** Alias: a PolicyCondition is a top-level condition group. */
export type PolicyCondition = PolicyConditionGroup;

export interface PolicyAction {
  type: 'alert_owner' | 'alert_admin' | 'alert_slack' | 'alert_webhook' | 'create_task' | 'mark_flagged' | 'quarantine';
  config?: Record<string, unknown>;
}

export interface PolicyScope {
  sources?: ConnectorKind[];
  environments?: string[];
  tags?: string[];
}

export interface Policy {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  severity: PolicySeverity;
  conditions: PolicyConditionGroup;
  scope: PolicyScope;
  actions: PolicyAction[];
  created_by: string;
  last_run_at: string | null;
  last_run_violations: number;
  dry_run_mode: boolean;
  created_at: string;
  updated_at: string;
}

export type ViolationStatus = 'open' | 'acknowledged' | 'resolved' | 'suppressed';

export interface PolicyViolation {
  id: string;
  policy_id: string;
  asset_id: string;
  org_id: string;
  status: ViolationStatus;
  severity: PolicySeverity;
  details: Record<string, unknown>;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  first_detected_at: string;
  last_detected_at: string;
  // Joined
  asset?: Asset;
  policy?: Policy;
}

// ---- Events & Notifications ----

export type EventKind =
  | 'asset_discovered' | 'asset_changed' | 'asset_quarantined' | 'asset_archived'
  | 'owner_departed' | 'owner_assigned' | 'owner_orphaned'
  | 'risk_increased' | 'risk_decreased'
  | 'policy_violated' | 'policy_resolved'
  | 'review_overdue' | 'review_completed'
  | 'compliance_gap' | 'compliance_resolved'
  | 'connector_sync_started' | 'connector_sync_completed' | 'connector_sync_failed'
  | 'task_created' | 'task_completed'
  | 'member_invited' | 'member_joined' | 'member_removed';

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface Event {
  id: string;
  org_id: string;
  kind: EventKind;
  severity: Severity;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  asset_id: string | null;
  connector_id: string | null;
  policy_id: string | null;
  actor_id: string | null;
  created_at: string;
  // Joined
  asset?: Pick<Asset, 'id' | 'name' | 'source' | 'risk_level'>;
}

export interface Notification {
  id: string;
  org_id: string;
  user_id: string;
  event_id: string | null;
  title: string;
  body: string | null;
  kind: string;
  severity: Severity;
  read_at: string | null;
  created_at: string;
}

export interface AlertPreferences {
  id: string;
  org_id: string;
  slack_webhook_url: string | null;
  slack_channel: string | null;
  email_recipients: string[];
  webhook_urls: string[];
  event_filters: Record<string, string[]>;
  digest_mode: boolean;
  digest_schedule: string | null;
  suppression_rules: Array<{ kind: string; cooldownHours: number }>;
  updated_at: string;
}

export interface AlertDelivery {
  id: string;
  org_id: string;
  event_id: string;
  channel: 'email' | 'slack' | 'webhook';
  recipient: string;
  status: 'pending' | 'sent' | 'failed';
  error: string | null;
  sent_at: string | null;
  created_at: string;
}

// ---- Compliance ----

export interface ComplianceControl {
  id: string;
  name: string;
  description: string;
  category: string;
  required: boolean;
}

export interface ComplianceFramework {
  id: string;
  org_id: string | null;
  name: string;
  code: string;
  version: string | null;
  description: string | null;
  controls: ComplianceControl[];
  is_builtin: boolean;
  enabled: boolean;
  created_at: string;
}

export type ComplianceMappingStatus = 'compliant' | 'non_compliant' | 'not_applicable' | 'needs_review' | 'unknown';

/** Alias for convenience. */
export type ComplianceStatus = ComplianceMappingStatus;

export interface ComplianceMapping {
  id: string;
  org_id: string;
  asset_id: string;
  framework_id: string;
  control_id: string;
  status: ComplianceMappingStatus;
  evidence: string[];
  notes: string | null;
  assessed_by: string | null;
  assessed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Tasks ----

export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: string;
  org_id: string;
  asset_id: string | null;
  violation_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: string | null;
  created_by: string;
  due_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  asset?: Pick<Asset, 'id' | 'name' | 'source'>;
}

// ---- Audit Log ----

export interface AuditLogEntry {
  id: string;
  org_id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ---- Connector Sync Types ----

export interface NormalizedAsset {
  externalId: string;
  name: string;
  description?: string;
  kind: AssetKind;
  sourceUrl?: string;
  environment: Environment;
  ownerEmail?: string;
  aiServices: AIService[];
  dataClassification: string[];
  tags: string[];
  rawMetadata: Record<string, unknown>;
}

export interface SyncError {
  resource: string;
  message: string;
  recoverable: boolean;
}

export interface SyncResult {
  assets: NormalizedAsset[];
  errors: SyncError[];
  metadata: Record<string, unknown>;
}

export interface HREmployee {
  email: string;
  name: string;
  status: 'active' | 'inactive' | 'terminated';
  department?: string;
  managerId?: string;
}

export interface HRSyncResult {
  employees: HREmployee[];
  errors: SyncError[];
}

// ---- API Response Types ----

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiError {
  error: string;
  code?: string;
}

// ---- Entitlements ----

export interface PlanLimits {
  maxAssets: number; // -1 = unlimited
  maxConnectors: number; // -1 = unlimited
  frameworks: string[] | 'all';
  apiAccess: boolean;
  sso: boolean;
  multiUser: boolean;
}

// ---- Analytics ----

export interface AnalyticsSnapshot {
  totalAssets: number;
  assetsByRisk: Record<RiskLevel, number>;
  assetsByOwnerStatus: Record<OwnerStatus, number>;
  assetsBySource: Record<string, number>;
  assetsByStatus: Record<AssetStatus, number>;
  openViolations: number;
  criticalViolations: number;
  openTasks: number;
  connectorsActive: number;
  connectorsError: number;
  reviewedPercent: number;
  orphanedCount: number;
}

export interface TrendPoint {
  date: string;
  value: number;
  label?: string;
}

// ---- Request / Response Shapes ----

export interface ListParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, unknown>;
}

export interface CreateConnectorRequest {
  kind: ConnectorKind;
  name: string;
  credentials: Record<string, string>;
  config?: Record<string, unknown>;
  sync_schedule?: string;
  enabled?: boolean;
}

export interface UpdateConnectorRequest {
  name?: string;
  credentials?: Record<string, string>;
  config?: Record<string, unknown>;
  sync_schedule?: string;
  enabled?: boolean;
  status?: ConnectorStatus;
}

export interface UpdateAssetRequest {
  owner_id?: string | null;
  owner_email?: string | null;
  owner_status?: OwnerStatus;
  status?: AssetStatus;
  review_status?: ReviewStatus;
  review_notes?: string | null;
  tags?: string[];
  compliance_tags?: string[];
  environment?: Environment;
  description?: string | null;
}

export interface BulkAssetAction {
  asset_ids: string[];
  action: 'assign_owner' | 'change_status' | 'add_tags' | 'remove_tags' | 'change_review_status' | 'quarantine' | 'archive';
  payload: Record<string, unknown>;
}

export interface CreatePolicyRequest {
  name: string;
  description?: string;
  severity: PolicySeverity;
  conditions: PolicyConditionGroup;
  scope?: PolicyScope;
  actions: PolicyAction[];
  enabled?: boolean;
  dry_run_mode?: boolean;
}

export interface UpdatePolicyRequest {
  name?: string;
  description?: string | null;
  severity?: PolicySeverity;
  conditions?: PolicyConditionGroup;
  scope?: PolicyScope;
  actions?: PolicyAction[];
  enabled?: boolean;
  dry_run_mode?: boolean;
}

export interface InviteMemberRequest {
  email: string;
  role: OrgRole;
}

export interface SDKReportPayload {
  assets: Array<{
    externalId: string;
    name: string;
    description?: string;
    kind?: AssetKind;
    environment?: Environment;
    ownerEmail?: string;
    aiServices?: AIService[];
    dataClassification?: string[];
    tags?: string[];
    metadata?: Record<string, unknown>;
  }>;
  source?: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: TaskPriority;
  asset_id?: string;
  violation_id?: string;
  assigned_to?: string;
  due_at?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigned_to?: string | null;
  due_at?: string | null;
  notes?: string | null;
}

// ---- Analytics Dashboard ----

export interface AnalyticsDashboard {
  snapshot: AnalyticsSnapshot;
  trends: AnalyticsTrends;
  recentEvents: Event[];
  topRiskAssets: Asset[];
  openViolationsByPolicy: Array<{ policy: Pick<Policy, 'id' | 'name' | 'severity'>; count: number }>;
  orphanedAssets: number;
  complianceSummary: Record<string, { total: number; compliant: number; nonCompliant: number; needsReview: number }>;
}

export interface AnalyticsTrends {
  assetCount: TrendPoint[];
  riskScore: TrendPoint[];
  violationCount: TrendPoint[];
  orphanedCount: TrendPoint[];
  reviewCoverage: TrendPoint[];
}

// ---- Compliance Reports ----

export interface ComplianceGap {
  framework_id: string;
  framework_name: string;
  control_id: string;
  control_name: string;
  asset_id: string;
  asset_name: string;
  status: ComplianceMappingStatus;
  severity: Severity;
  recommendation: string | null;
}

export interface ComplianceReport {
  framework: ComplianceFramework;
  totalControls: number;
  compliantCount: number;
  nonCompliantCount: number;
  needsReviewCount: number;
  notApplicableCount: number;
  compliancePercent: number;
  gaps: ComplianceGap[];
  generatedAt: string;
}

// ---- SDK Report Types ----

export interface SDKReportAsset {
  externalId: string;
  name: string;
  description?: string;
  kind?: AssetKind;
  environment?: "production" | "staging" | "development" | "unknown";
  ownerEmail?: string;
  aiServices?: AIService[];
  dataClassification?: string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface SDKReportPayload {
  source?: string;
  assets: SDKReportAsset[];
}
