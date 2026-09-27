import { ProviderError, ProviderHttpError } from "./errors";

export interface RetryOptions {
  /** Retries after the first attempt. */
  retries: number;
  baseMs: number;
  maxMs: number;
  /** Retry-After values above this give up immediately as rate_limited. */
  maxRetryAfterMs: number;
  isRetryable: (err: unknown) => boolean;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
}

export const DEFAULT_RETRY: RetryOptions = {
  retries: 3,
  baseMs: 500,
  maxMs: 8_000,
  maxRetryAfterMs: 30_000,
  isRetryable: (err) => err instanceof ProviderError && err.retryable,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  random: Math.random,
};

export interface RetryOutcome<T> {
  value: T;
  attempts: number;
}

/**
 * Exponential backoff with full jitter. Honors Retry-After when the error
 * carries one (up to maxRetryAfterMs). Rethrows the last error once the
 * retries are spent; the caller decides how to report it.
 */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, options: Partial<RetryOptions> = {}): Promise<RetryOutcome<T>> {
  const o = { ...DEFAULT_RETRY, ...options };
  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      return { value: await fn(attempt), attempts: attempt };
    } catch (err) {
      if (attempt > o.retries || !o.isRetryable(err)) throw err;
      const retryAfter = err instanceof ProviderHttpError ? err.retryAfterMs : null;
      if (retryAfter !== null && retryAfter > o.maxRetryAfterMs) throw err;
      const backoff = Math.min(o.maxMs, o.baseMs * 2 ** (attempt - 1)) * o.random();
      const delayMs = Math.max(backoff, retryAfter ?? 0);
      o.onRetry?.({ attempt, delayMs, error: err });
      await o.sleep(delayMs);
    }
  }
}
