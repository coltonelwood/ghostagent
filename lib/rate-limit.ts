/**
 * Simple in-memory sliding-window rate limiter.
 * For single-instance deployments (Vercel hobby/pro with one function instance).
 * Replace with Upstash Redis rate limiter for multi-instance production.
 *
 * Usage:
 *   const limiter = new RateLimiter({ windowMs: 60_000, max: 10 });
 *   if (!limiter.check(identifier)) return 429
 */

interface RateLimitEntry {
  timestamps: number[];
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private windowMs: number;
  private max: number;

  constructor({ windowMs, max }: { windowMs: number; max: number }) {
    this.windowMs = windowMs;
    this.max = max;
  }

  /** Returns true if request is allowed, false if rate limited */
  check(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const entry = this.store.get(key) ?? { timestamps: [] };
    // Purge old timestamps
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

    if (entry.timestamps.length >= this.max) {
      this.store.set(key, entry);
      return false; // rate limited
    }

    entry.timestamps.push(now);
    this.store.set(key, entry);
    return true; // allowed
  }

  /** Cleanup stale entries (call periodically to prevent memory leak) */
  purge() {
    const windowStart = Date.now() - this.windowMs;
    for (const [key, entry] of this.store.entries()) {
      if (entry.timestamps.every((t) => t < windowStart)) {
        this.store.delete(key);
      }
    }
  }
}

// Shared limiters
export const scanRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                    // 5 scans/hour per user
});

export const apiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60,             // 60 requests/minute per user
});

export const authRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 auth attempts per 15 min per IP
});

// Auto-purge every 10 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    scanRateLimiter.purge();
    apiRateLimiter.purge();
    authRateLimiter.purge();
  }, 10 * 60 * 1000);
}
