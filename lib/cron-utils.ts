/**
 * Lightweight cron-to-interval converter.
 *
 * We only need to decide "is a connector overdue for a sync?" so
 * converting common cron patterns to an approximate interval in
 * milliseconds is sufficient. For anything we can't parse, we
 * fall back to a safe 6-hour default.
 *
 * Supported patterns:
 *   "* /N * * *"       => every N hours  (e.g. 0 * /6 * * *)
 *   "0 N * * *"        => daily at hour N (interval = 24h)
 *   "* /N * * * *"     => every N minutes (6-field variant)
 *   "0 0 * * *"        => daily (24h)
 *   Anything else      => 6h fallback
 */

const MS_MINUTE = 60 * 1000;
const MS_HOUR = 60 * MS_MINUTE;
const DEFAULT_INTERVAL_MS = 6 * MS_HOUR;

/**
 * Parse a cron expression and return the approximate interval in
 * milliseconds between runs.
 */
export function cronToIntervalMs(cron: string): number {
  if (!cron || typeof cron !== "string") return DEFAULT_INTERVAL_MS;

  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) return DEFAULT_INTERVAL_MS;

  // Normalize to 5-field (strip optional seconds field)
  const [minute, hour, dayOfMonth, month, dayOfWeek] =
    parts.length === 6 ? parts.slice(1) : parts;

  // Every N minutes: "*/N * * * *"
  if (hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const stepMatch = minute.match(/^\*\/(\d+)$/);
    if (stepMatch) {
      const n = parseInt(stepMatch[1], 10);
      if (n > 0) return n * MS_MINUTE;
    }
  }

  // Every N hours: "0 */N * * *"  or  "M */N * * *"
  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const stepMatch = hour.match(/^\*\/(\d+)$/);
    if (stepMatch) {
      const n = parseInt(stepMatch[1], 10);
      if (n > 0) return n * MS_HOUR;
    }
  }

  // Daily at a fixed hour: "0 H * * *" or "M H * * *"
  if (
    /^\d+$/.test(hour) &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    return 24 * MS_HOUR;
  }

  // Weekly: "M H * * D"  (where D is a single digit or name)
  if (/^\d+$/.test(hour) && dayOfMonth === "*" && month === "*" && /^\d$/.test(dayOfWeek)) {
    return 7 * 24 * MS_HOUR;
  }

  return DEFAULT_INTERVAL_MS;
}

/** Default sync schedule for new connectors (every 6 hours). */
export const DEFAULT_SYNC_SCHEDULE = "0 */6 * * *";
