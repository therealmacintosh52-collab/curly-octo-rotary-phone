/** Errors thrown inside `execute()`; the provider core maps them to UNAVAILABLE. */

export class ProviderError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable = false) {
    super(message);
    this.name = new.target.name;
    this.retryable = retryable;
  }
}

export class ProviderNotConfigured extends ProviderError {
  constructor(provider: string, keys: string[]) {
    super(`${provider} is not configured: set ${keys.join(", ")}`, false);
  }
}

export class ProviderNotImplemented extends ProviderError {
  constructor(provider: string, endpoint: string, phase: string) {
    super(`${provider}.${endpoint} has no live implementation yet (arrives in phase ${phase}); use mock mode`, false);
  }
}

export class ProviderTimeout extends ProviderError {
  constructor(ms: number) {
    super(`timed out after ${ms} ms`, true);
  }
}

export class ProviderNetworkError extends ProviderError {
  constructor(message: string) {
    super(message, true);
  }
}

export class ProviderHttpError extends ProviderError {
  readonly status: number;
  readonly body: unknown;
  /** Parsed Retry-After, when the response carried one. */
  readonly retryAfterMs: number | null;
  constructor(status: number, body: unknown, retryAfterMs: number | null = null) {
    super(`HTTP ${status}`, status === 429 || status >= 500);
    this.status = status;
    this.body = body;
    this.retryAfterMs = retryAfterMs;
  }
}

export class ProviderParseError extends ProviderError {
  readonly issues: unknown;
  constructor(message: string, issues: unknown) {
    super(message, false);
    this.issues = issues;
  }
}

/** Parses an HTTP Retry-After header (seconds or HTTP-date) into milliseconds. */
export function parseRetryAfter(value: string | null | undefined, now: Date = new Date()): number | null {
  if (!value) return null;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(value);
  if (Number.isNaN(at)) return null;
  return Math.max(0, at - now.getTime());
}
