import { createHash, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

/**
 * Constant-time secret comparison for internal-only routes.
 *
 * Previously each internal route did `provided !== process.env.X`. On long
 * secrets this is ~impossible to exploit in practice, but string-equality
 * short-circuits on the first mismatched byte, which is a textbook timing
 * oracle. We SHA-256 both sides (so length isn't a side channel either)
 * and use Node's crypto.timingSafeEqual.
 *
 * Returns `false` if the provided value is empty, the env var is missing,
 * or the comparison fails. Never throws.
 */
function secureCompare(provided: string | null | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Authorize an internal service-to-service call. Accepts either:
 *   - `x-internal-key: <INTERNAL_API_KEY>`          (most internal routes)
 *   - `Authorization: Bearer <INTERNAL_API_KEY>`    (Vercel/curl friendliness)
 *
 * Used by the POST handlers of scan-worker, sync-worker, cleanup.
 */
export function verifyInternalKey(req: NextRequest): boolean {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) return false;
  const xkey = req.headers.get("x-internal-key");
  if (xkey && secureCompare(xkey, expected)) return true;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer && secureCompare(bearer, expected)) return true;
  return false;
}

/**
 * Authorize a Vercel cron invocation. Vercel sends
 *   Authorization: Bearer <CRON_SECRET>
 * on every scheduled request. Env validation guarantees CRON_SECRET is
 * set in production, but we still fail closed if it happens to be missing
 * so a misconfigured deploy can't accidentally expose the cron endpoint.
 */
export function verifyCronSecret(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return secureCompare(bearer, expected);
}
