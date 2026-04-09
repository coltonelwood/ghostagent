import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

export type OrgRole = "owner" | "admin" | "operator" | "viewer";

const ROLE_LEVEL: Record<OrgRole, number> = {
  owner: 4,
  admin: 3,
  operator: 2,
  viewer: 1,
};

export async function getAuthUser(): Promise<{
  id: string;
  email: string;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? "" };
}

export async function getUserOrg(
  userId: string,
): Promise<{ orgId: string; role: OrgRole } | null> {
  const db = getAdminClient();
  const { data } = await db
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", userId)
    .limit(1)
    .single();
  if (!data) return null;
  return { orgId: data.org_id, role: data.role as OrgRole };
}

export async function requireAuth(): Promise<{
  userId: string;
  email: string;
  orgId: string;
  role: OrgRole;
}> {
  const user = await getAuthUser();
  if (!user) {
    throw new AuthError("Unauthorized", 401);
  }
  const org = await getUserOrg(user.id);
  if (!org) {
    throw new AuthError("No organization membership found", 403);
  }
  return { userId: user.id, email: user.email, orgId: org.orgId, role: org.role };
}

export async function requireRole(
  minRole: OrgRole,
): Promise<{
  userId: string;
  email: string;
  orgId: string;
  role: OrgRole;
}> {
  const auth = await requireAuth();
  if (!hasRole(auth.role, minRole)) {
    throw new AuthError(
      `Requires ${minRole} role or higher. You have ${auth.role}.`,
      403,
    );
  }
  return auth;
}

export function hasRole(userRole: OrgRole, minRole: OrgRole): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minRole];
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
