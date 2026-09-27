import { describe, expect, it, vi } from "vitest";
import { parseRetryAfter, ProviderHttpError, ProviderNetworkError, ProviderTimeout } from "./errors";
import { withRetry } from "./retry";

const noSleep = { sleep: vi.fn(async (_ms: number) => {}), random: () => 1 };

describe("withRetry", () => {
  it("returns on first success with attempts = 1", async () => {
    const out = await withRetry(async () => "ok", noSleep);
    expect(out).toEqual({ value: "ok", attempts: 1 });
  });

  it("retries retryable errors with exponential backoff and stops at retries", async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    const fn = vi.fn(async () => {
      throw new ProviderNetworkError("boom");
    });
    await expect(withRetry(fn, { retries: 2, baseMs: 100, maxMs: 10_000, sleep, random: () => 1 })).rejects.toBeInstanceOf(ProviderNetworkError);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([100, 200]);
  });

  it("does not retry non-retryable errors", async () => {
    const fn = vi.fn(async () => {
      throw new ProviderHttpError(400, "bad");
    });
    await expect(withRetry(fn, noSleep)).rejects.toBeInstanceOf(ProviderHttpError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("honors Retry-After when it is longer than the backoff", async () => {
    const sleep = vi.fn(async () => {});
    let n = 0;
    const out = await withRetry(
      async () => {
        if (n++ === 0) throw new ProviderHttpError(429, "slow down", 2_000);
        return "ok";
      },
      { baseMs: 100, sleep, random: () => 1 },
    );
    expect(out.attempts).toBe(2);
    expect(sleep).toHaveBeenCalledWith(2_000);
  });

  it("gives up immediately when Retry-After exceeds the cap", async () => {
    const sleep = vi.fn(async () => {});
    const fn = vi.fn(async () => {
      throw new ProviderHttpError(429, "slow down", 120_000);
    });
    await expect(withRetry(fn, { sleep, maxRetryAfterMs: 30_000 })).rejects.toBeInstanceOf(ProviderHttpError);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("treats timeouts as retryable", async () => {
    let n = 0;
    const out = await withRetry(async () => {
      if (n++ < 2) throw new ProviderTimeout(10);
      return n;
    }, noSleep);
    expect(out).toEqual({ value: 3, attempts: 3 });
  });
});

describe("parseRetryAfter", () => {
  it("parses seconds", () => {
    expect(parseRetryAfter("3")).toBe(3000);
  });
  it("parses an HTTP date relative to now", () => {
    const now = new Date("2026-09-27T00:00:00Z");
    expect(parseRetryAfter("Sun, 27 Sep 2026 00:00:05 GMT", now)).toBe(5000);
  });
  it("returns null for junk or nothing", () => {
    expect(parseRetryAfter("soon")).toBeNull();
    expect(parseRetryAfter(null)).toBeNull();
  });
});
