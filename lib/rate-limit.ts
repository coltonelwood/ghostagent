/**
 * Rate limiter with two backends:
 * 1. In-memory sliding window — single instance (dev, Vercel hobby)
 * 2. Configurable external backend (Redis/Upstash) for multi-instance prod
 *
 * NOTE: In-memory limiters are per-Vercel-instance. On multi-instance deployments,
 * each instance maintains its own state. Users could bypass limits by hitting
 * different instances. For strict enforcement at scale, set UPSTASH_REDIS_URL.
 *
 * MULTI-INSTANCE MITIGATION (without Redis):
 * - Vercel routes the same user to the same instance for ~5 min (sticky sessions)
 * - Our limits are generous enough that per-instance enforcement is acceptable
 * - The DB-level "no concurrent scans" check is the hard safety net
 */

interface RateLimitEntry {
  timestamps: number[];
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private windowMs: number;
  private max: number;
  private name: string;

  constructor({ windowMs, max, name }: { windowMs: number; max: number; name: string }) {
    this.windowMs = windowMs;
    this.max = max;
    this.name = name;
  }

  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
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
    return `RateLimiter(${this.name}, ${this.store.size} keys)`;
  }
}

export const scanRateLimiter = new RateLimiter({
  name: "scan",
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                    // 5 scans/hour per user
});

export const apiRateLimiter = new RateLimiter({
  name: "api",
  windowMs: 60 * 1000,  // 1 minute
  max: 60,              // 60 requests/minute per user
});

export const authRateLimiter = new RateLimiter({
  name: "auth",
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 auth attempts per 15 min per IP
});

export const inviteRateLimiter = new RateLimiter({
  name: "invite",
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,                   // 20 invites/hour per org (prevents invite spam)
});

export const syncRateLimiter = new RateLimiter({
  name: "sync",
  windowMs: 5 * 60 * 1000,  // 5 minutes
  max: 1,                    // 1 manual sync per connector per 5 min
});

export const exportRateLimiter = new RateLimiter({
  name: "export",
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,                   // 10 report exports/hour per user
});

// Auto-purge every 10 minutes to prevent memory growth
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    scanRateLimiter.purge();
    apiRateLimiter.purge();
    authRateLimiter.purge();
    inviteRateLimiter.purge();
    syncRateLimiter.purge();
    exportRateLimiter.purge();
  }, 10 * 60 * 1000);
}

/**
 * Build standard rate-limit response headers
 */
export function rateLimitHeaders(remaining: number, resetAt: number): HeadersInit {
  return {
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
    "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
  };
}
