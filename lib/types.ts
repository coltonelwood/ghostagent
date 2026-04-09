export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  github_org: string | null;
  // github_token intentionally omitted from client-facing type — never expose to UI
  github_token?: string | null;
  stripe_customer_id: string | null;
  stripe_sub_id: string | null;
  plan: "trial" | "pro" | "enterprise";
  scan_count: number;
  created_at: string;
}

export interface Scan {
  id: string;
  workspace_id: string;
  status: "pending" | "scanning" | "classifying" | "completed" | "failed";
  repos_scanned: number;
  agents_found: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface Agent {
  id: string;
  scan_id: string;
  workspace_id: string;
  name: string;
  repo: string;
  file_path: string;
  owner_github: string | null;
  owner_email: string | null;
  last_commit_at: string | null;
  days_since_commit: number | null;
  agent_type: string | null;
  description: string | null;
  risk_level: "critical" | "high" | "medium" | "low";
  risk_reason: string | null;
  why_flagged: string | null;        // plain-English explanation for non-technical readers
  confidence_score: number | null;  // 0-100: how confident is the scanner in this finding
  detection_class: string | null;   // which detection class triggered this
  compliance_tags: string[];        // e.g. ["HIPAA", "SOC2"]
  services: string[];
  has_secrets: boolean;
  status: "active" | "acknowledged" | "decommissioned";
  created_at: string;
}
