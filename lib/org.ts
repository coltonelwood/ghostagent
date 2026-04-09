import { adminClient } from "./supabase/admin";
import type { Organization, OrgMember, OrgRole } from "./types/platform";

export class OrgAuthError extends Error {
  code = "ORG_AUTH_ERROR";
  status = 403;
  constructor(message = "You do not have permission to perform this action") {
    super(message);
    this.name = "OrgAuthError";
  }
}

export class OrgNotFoundError extends Error {
  code = "ORG_NOT_FOUND";
  status = 404;
  constructor() {
    super("Organization not found");
    this.name = "OrgNotFoundError";
  }
}

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 4,
  admin: 3,
  operator: 2,
  viewer: 1,
};

export function hasRole(member: OrgMember, minRole: OrgRole): boolean {
  return ROLE_HIERARCHY[member.role] >= ROLE_HIERARCHY[minRole];
}

/**
 * Verify that `userId` is a member of `orgId` with at least `minRole`.
 * Throws OrgAuthError if not. Returns the OrgMember record.
 */
export async function requireOrgMember(
  userId: string,
  orgId: string,
  minRole: OrgRole = "viewer"
): Promise<OrgMember> {
  const { data, error } = await adminClient
    .from("org_members")
    .select("*")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new OrgAuthError("You are not a member of this organization");
  }

  if (!hasRole(data as OrgMember, minRole)) {
    throw new OrgAuthError(
      `This action requires ${minRole} role. Your role is ${data.role}.`
    );
  }

  return data as OrgMember;
}

/**
 * Get the organization for a user (first org they're a member of).
 * Most users have exactly one org initially.
 */
export async function getOrgForUser(userId: string): Promise<Organization | null> {
  const { data, error } = await adminClient
    .from("org_members")
    .select("org_id, organizations(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;

  const orgs = data as unknown as { organizations: Organization };
  return orgs.organizations ?? null;
}

/**
 * Get or create an organization for a user.
 * Creates a new org if the user has none.
 */
export async function getOrCreateOrgForUser(
  userId: string,
  userEmail: string
): Promise<Organization> {
  const existing = await getOrgForUser(userId);
  if (existing) return existing;

  // Create new org
  const slug = userEmail.split("@")[0]?.replace(/[^a-z0-9]/g, "").slice(0, 20) +
    "-" + Math.random().toString(36).slice(2, 6);
  const name = userEmail.split("@")[0] + "'s Organization";

  const { data: org, error: orgError } = await adminClient
    .from("organizations")
    .insert({ name, slug, plan: "starter" })
    .select()
    .single();

  if (orgError || !org) {
    throw new Error(`Failed to create organization: ${orgError?.message}`);
  }

  // Add user as owner
  await adminClient.from("org_members").insert({
    org_id: org.id,
    user_id: userId,
    role: "owner",
    accepted_at: new Date().toISOString(),
  });

  return org as Organization;
}

/**
 * Get organization by ID (with membership check).
 */
export async function getOrg(orgId: string): Promise<Organization | null> {
  const { data, error } = await adminClient
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (error || !data) return null;
  return data as Organization;
}

/**
 * Get asset count for an org.
 */
export async function getOrgAssetCount(orgId: string): Promise<number> {
  const { count } = await adminClient
    .from("assets")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "active");
  return count ?? 0;
}

/**
 * Get connector count for an org.
 */
export async function getOrgConnectorCount(orgId: string): Promise<number> {
  const { count } = await adminClient
    .from("connectors")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .neq("status", "disconnected");
  return count ?? 0;
}
