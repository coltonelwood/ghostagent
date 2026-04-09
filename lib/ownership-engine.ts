import type { OwnerStatus, HREmployee, NormalizedAsset } from "./types/platform";

export interface OwnershipResult {
  ownerEmail: string | null;
  ownerConfidence: number;
  ownerSource: string;
  ownerStatus: OwnerStatus;
}

export function resolveOwnership(
  asset: NormalizedAsset,
  existingOwnerEmail: string | null,
  hrEmployees: HREmployee[] | null
): OwnershipResult {
  const meta = asset.rawMetadata ?? {};
  let ownerEmail: string | null = null;
  let confidence = 0;
  let source = "unknown";

  if (existingOwnerEmail) {
    ownerEmail = existingOwnerEmail; confidence = 100; source = "explicit_assignment";
  } else if (asset.ownerEmail) {
    ownerEmail = asset.ownerEmail; confidence = 85; source = "source_metadata";
  } else if (typeof meta.lastCommitterEmail === "string") {
    ownerEmail = meta.lastCommitterEmail; confidence = 80; source = "git_blame";
  } else if (typeof meta.creatorEmail === "string") {
    ownerEmail = meta.creatorEmail; confidence = 75; source = "creator_metadata";
  } else if (typeof meta.ownerTag === "string") {
    ownerEmail = meta.ownerTag; confidence = 70; source = "infra_tag";
  } else if (typeof meta.topCommitterEmail === "string") {
    ownerEmail = meta.topCommitterEmail; confidence = 60; source = "top_committer";
  }

  const ownerStatus = deriveStatus(ownerEmail, confidence, hrEmployees);
  return { ownerEmail, ownerConfidence: confidence, ownerSource: source, ownerStatus };
}

function deriveStatus(
  email: string | null,
  confidence: number,
  hrEmployees: HREmployee[] | null
): OwnerStatus {
  if (!email || confidence === 0) return "unknown_owner";
  if (!hrEmployees) return confidence >= 70 ? "active_owner" : "unknown_owner";

  const emp = hrEmployees.find(e => e.email.toLowerCase() === email.toLowerCase());
  if (!emp) return "inactive_owner";
  if (emp.status === "terminated" || emp.status === "inactive") return "inactive_owner";
  return "active_owner";
}

export function shouldMarkOrphaned(asset: {
  owner_status: OwnerStatus;
  last_changed_at: string;
  environment: string;
}): boolean {
  if (asset.owner_status === "orphaned") return true;
  if (asset.owner_status === "inactive_owner") {
    const days = Math.floor((Date.now() - new Date(asset.last_changed_at).getTime()) / 86400000);
    return days >= 7;
  }
  return false;
}

export function ownerConfidenceLabel(confidence: number): string {
  if (confidence >= 90) return "Verified";
  if (confidence >= 70) return "High";
  if (confidence >= 50) return "Medium";
  if (confidence > 0) return "Low";
  return "Unknown";
}
