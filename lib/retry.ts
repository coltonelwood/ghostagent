import logger from "@/lib/logger";

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (err: unknown) => boolean;
  label?: string;
}

/**
 * Retry an async function with exponential backoff + jitter.
 * Default: 3 attempts, 1s base delay, 30s max delay.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30_000,
    shouldRetry = isRetryable,
    label = "operation",
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxAttempts || !shouldRetry(err)) {
        logger.error({ label, attempt, maxAttempts, err }, "retry: exhausted");
        throw err;
      }

      // Exponential backoff with full jitter
      const expDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * baseDelayMs;
      const delay = Math.min(expDelay + jitter, maxDelayMs);

      logger.warn({ label, attempt, maxAttempts, delay: Math.round(delay) }, "retry: backing off");
      await sleep(delay);
    }
  }

  throw lastError;
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    // GitHub/network errors that are transient
    if (err.message.includes("rate limit") || err.message.includes("Rate limit")) return true;
    if (err.message.includes("ECONNRESET") || err.message.includes("ETIMEDOUT")) return true;
    if (err.message.includes("ENOTFOUND")) return false; // DNS failure — don't retry
    if (err.message.includes("secondary rate limit")) return true;
    if (err.message.includes("502") || err.message.includes("503") || err.message.includes("504")) return true;
  }
  // HTTP status-based
  const status = (err as { status?: number })?.status;
  if (status === 429 || status === 503 || status === 504) return true;
  if (status && status >= 400 && status < 500 && status !== 429) return false; // client errors
  return true;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
