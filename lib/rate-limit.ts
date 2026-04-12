/**
 * Rate limiter with two backends:
 *
 *   1. Upstash Redis (REST API) — used automatically when
 *      UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set. Shared
 *      state across all Vercel instances, so limits actually hold under
 *      autoscale. Uses fixed-window counters: INCR on the first hit sets
 *      a TTL equal to the window, subsequent hits just INCR.
 *
 *   2. In-memory sliding window — used in dev and as a fallback when
 *      Upstash env vars are missing. Single-instance only; the env
 *      validator warns loudly when this fallback kicks in for production.
 *
 * The DB-level "no concurrent scans" check in /api/scan is the final
 * safety net and is independent of either limiter backend.
 */

// ---------------------------------------------------------------------------
// Upstash REST client (no dependencies — just fetch)
// ---------------------------------------------------------------------------

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "") ?? "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
const UPSTASH_ENABLED = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

async function upstashCommand(
  args: (string | number)[],
  timeoutMs = 1500,
): Promise<{ result: unknown } | { error: string }> {
  if (!UPSTASH_ENABLED) return { error: "not_configured" };
  try {
    const res = await fetch(UPSTASH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args.map(String)),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return { error: `upstash ${res.status}` };
    }
    return (await res.json()) as { result: unknown };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "upstash network error",
    };
  }
}

interface LimiterCheck {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Fixed-window counter against Upstash. We INCR the key and, if the
 * returned value is 1 (i.e. fresh window), set an EXPIRE equal to the
 * window length. Not as smooth as a sliding window but much cheaper and
 * completely sufficient for API-abuse protection.
 *
 * Returns null on any Upstash failure so the caller can fall back to
 * in-memory instead of blocking real users when Redis is unreachable.
 */
async function upstashFixedWindow(
  name: string,
  key: string,
  windowMs: number,
  max: number,
): Promise<LimiterCheck | null> {
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  // Bucket the window server-side so all instances agree on boundaries.
  const bucket = Math.floor(Date.now() / windowMs);
  const redisKey = `rl:${name}:${key}:${bucket}`;

  const incr = await upstashCommand(["INCR", redisKey]);
  if ("error" in incr) return null;
  const count =
    typeof incr.result === "number" ? incr.result : Number(incr.result);
  if (!Number.isFinite(count)) return null;

  if (count === 1) {
    // Fresh window — set expiry. Fire and forget; a lost EXPIRE call
    // would only leak a single idle key, which TTL scavenging handles.
    upstashCommand(["EXPIRE", redisKey, windowSec]).catch(() => {});
  }

  const resetAt = (bucket + 1) * windowMs;
  if (count > max) {
    return { allowed: false, remaining: 0, resetAt };
  }
  return {
    allowed: true,
    remaining: Math.max(0, max - count),
    resetAt,
  };
}

// ---------------------------------------------------------------------------
// In-memory sliding window (fallback)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  timestamps: number[];
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private windowMs: number;
  private max: number;
  private name: string;

  constructor({
    windowMs,
    max,
    name,
  }: {
    windowMs: number;
    max: number;
    name: string;
  }) {
    this.windowMs = windowMs;
    this.max = max;
    this.name = name;
  }

  /**
   * Synchronous, in-memory check. Kept as the default so existing
   * callers need no code changes. Use `checkAsync` from new code when
   * you want distributed enforcement via Upstash.
   */
  check(key: string): LimiterCheck {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const entry = this.store.get(key) ?? { timestamps: [] };
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

    const remaining = Math.max(0, this.max - entry.timestamps.length - 1);
    const resetAt = now + this.windowMs;

    if (entry.timestamps.length >= this.max) {
      this.store.set(key, entry);
      return { allowed: false, remaining: 0, resetAt };
    }

    entry.timestamps.push(now);
    this.store.set(key, entry);
    return { allowed: true, remaining, resetAt };
  }

  /**
   * Upstash-first async check. Falls back to in-memory on any Upstash
   * error so a Redis outage never locks real users out.
   */
  async checkAsync(key: string): Promise<LimiterCheck> {
    if (UPSTASH_ENABLED) {
      const redisResult = await upstashFixedWindow(
        this.name,
        key,
        this.windowMs,
        this.max,
      );
      if (redisResult) return redisResult;
    }
    return this.check(key);
  }

  purge() {
    const windowStart = Date.now() - this.windowMs;
    for (const [key, entry] of this.store.entries()) {
      if (entry.timestamps.every((t) => t < windowStart)) {
        this.store.delete(key);
      }
    }
  }

  get size() {
    return this.store.size;
  }

  toString() {
    return `RateLimiter(${this.name}, ${this.store.size} keys, upstash=${UPSTASH_ENABLED})`;
  }
}

// ---------------------------------------------------------------------------
// Shared instances
// ---------------------------------------------------------------------------

export const scanRateLimiter = new RateLimiter({
  name: "scan",
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 scans/hour per user
});

export const apiRateLimiter = new RateLimiter({
  name: "api",
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests/minute per user
});

export const authRateLimiter = new RateLimiter({
  name: "auth",
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 auth attempts per 15 min per IP
});

export const inviteRateLimiter = new RateLimiter({
  name: "invite",
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 invites/hour per org (prevents invite spam)
});

export const syncRateLimiter = new RateLimiter({
  name: "sync",
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 1, // 1 manual sync per connector per 5 min
});

export const exportRateLimiter = new RateLimiter({
  name: "export",
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 report exports/hour per user
});

// Auto-purge the in-memory fallback every 10 minutes to prevent memory growth.
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      scanRateLimiter.purge();
      apiRateLimiter.purge();
      authRateLimiter.purge();
      inviteRateLimiter.purge();
      syncRateLimiter.purge();
      exportRateLimiter.purge();
    },
    10 * 60 * 1000,
  );
}

/**
 * Build standard rate-limit response headers.
 */
export function rateLimitHeaders(
  remaining: number,
  resetAt: number,
): HeadersInit {
  return {
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
    "Retry-After": String(Math.max(0, Math.ceil((resetAt - Date.now()) / 1000))),
  };
}

export function isUpstashEnabled(): boolean {
  return UPSTASH_ENABLED;
}
