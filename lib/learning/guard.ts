/**
 * Access guard for the self-learning engine surface.
 *
 * Two ways to authorize a request:
 *   1. INTERNAL_API_KEY header — same shape as /api/internal/*, for
 *      ops tooling and background jobs.
 *   2. Authenticated user whose email is in LEARNING_ADMIN_EMAILS —
 *      comma-separated list in env, matched case-insensitively.
 *
 * Additionally, the ENTIRE surface is gated by NEXUS_LEARNING_ENABLED
 * being set to "true". If the flag is off, every endpoint 404s —
 * customers never even see the route exists.
 */

import type { NextRequest } from "next/server";
import { verifyInternalKey } from "@/lib/internal-auth";
import { getAuthUser } from "@/lib/org-auth";

export function isLearningEnabled(): boolean {
  return process.env.NEXUS_LEARNING_ENABLED === "true";
}

function parseAdminEmails(): string[] {
  const raw = process.env.LEARNING_ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function authorizeLearningRequest(
  req: NextRequest,
): Promise<{ ok: true; actor: string } | { ok: false; status: number; message: string }> {
  if (!isLearningEnabled()) {
    // Pretend the endpoint doesn't exist so we don't tip off customers
    // that a learning surface is deployed.
    return { ok: false, status: 404, message: "Not found" };
  }

  if (verifyInternalKey(req)) {
    return { ok: true, actor: "internal-key" };
  }

  const user = await getAuthUser();
  if (!user) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }
  const allowedEmails = new Set(parseAdminEmails());
  if (allowedEmails.size === 0) {
    // If nobody is configured as admin, only internal-key callers work.
    return {
      ok: false,
      status: 403,
      message: "Learning surface is enabled but no LEARNING_ADMIN_EMAILS are configured.",
    };
  }
  const email = (user.email ?? "").toLowerCase();
  if (!allowedEmails.has(email)) {
    return { ok: false, status: 403, message: "Not a learning admin." };
  }
  return { ok: true, actor: email };
}
