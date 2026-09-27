import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ProviderHttpError, ProviderNotImplemented, ProviderTimeout } from "./errors";
import { createProvider, type ProviderDefinition } from "./provider";
import { MemorySnapshotStore } from "./snapshots";

const def = (env: Record<string, string | undefined> = {}): ProviderDefinition => ({
  name: "website",
  label: "Test provider",
  docsUrl: "https://example.test",
  envKeys: ["TEST_KEY"],
  timeoutMs: 1_000,
  defaultTtlSeconds: 3600,
  phase: "0",
  env,
  retry: { sleep: async () => {}, random: () => 1, baseMs: 1 },
});

const Schema = z.object({ value: z.number() });

describe("createProvider().call", () => {
  it("mock mode: serves a fixture and never calls execute", async () => {
    const p = createProvider(def());
    const execute = vi.fn();
    const res = await p.call({ endpoint: "fetchPage", request: { url: "x" }, ctx: { store: new MemorySnapshotStore(), mode: "mock" }, execute });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect((res.data as { status: number }).status).toBe(200);
      expect(res.meta).toMatchObject({ cached: true, cost_usd: 0, mode: "mock", provider: "website" });
    }
    expect(execute).not.toHaveBeenCalled();
  });

  it("mock mode: a missing fixture is UNAVAILABLE no_fixture, never invented", async () => {
    const p = createProvider(def());
    const res = await p.call({ endpoint: "does-not-exist", request: {}, ctx: { store: new MemorySnapshotStore(), mode: "mock" }, execute: vi.fn() });
    expect(res).toMatchObject({ ok: false, kind: "UNAVAILABLE", reason: "no_fixture" });
  });

  it("live mode: not_configured when env keys are missing", async () => {
    const p = createProvider(def({}));
    const execute = vi.fn();
    const res = await p.call({ endpoint: "e", request: {}, ctx: { store: new MemorySnapshotStore(), mode: "live" }, execute });
    expect(res).toMatchObject({ ok: false, reason: "not_configured" });
    expect(execute).not.toHaveBeenCalled();
    expect(p.isConfigured()).toBe(false);
    expect(p.status().envKeys).toEqual([{ key: "TEST_KEY", set: false }]);
  });

  it("live mode: executes, validates, persists the snapshot with cost, then serves the cache", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const p = createProvider(def({ TEST_KEY: "k" }));
    const store = new MemorySnapshotStore();
    const execute = vi.fn(async () => ({ response: { value: 42 }, costUsd: 0.25 }));
    const ctx = { store, mode: "live" as const, auditId: "audit-1" };

    const first = await p.call({ endpoint: "e", request: { q: 1 }, ctx, execute, schema: Schema });
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.data).toEqual({ value: 42 });
      expect(first.meta).toMatchObject({ cached: false, cost_usd: 0.25, attempts: 1, snapshot_id: "mem-1" });
    }
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]).toMatchObject({ audit_id: "audit-1", provider: "website", endpoint: "e", cost_usd: 0.25 });
    expect(store.rows[0].expires_at).not.toBeNull();
    expect(await store.sumCost("audit-1")).toBe(0.25);

    const second = await p.call({ endpoint: "e", request: { q: 1 }, ctx, execute, schema: Schema });
    expect(second.ok && second.meta.cached).toBe(true);
    expect(second.ok && second.meta.cost_usd).toBe(0);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("live mode: retries retryable errors and reports attempts", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const p = createProvider(def({ TEST_KEY: "k" }));
    let n = 0;
    const execute = vi.fn(async () => {
      if (n++ < 2) throw new ProviderTimeout(1);
      return { response: { value: 1 }, costUsd: 0 };
    });
    const res = await p.call({ endpoint: "e", request: {}, ctx: { store: new MemorySnapshotStore(), mode: "live" }, execute, schema: Schema });
    expect(res.ok && res.meta.attempts).toBe(3);
  });

  it("live mode: maps HTTP errors and rate limits to UNAVAILABLE with status", async () => {
    const p = createProvider(def({ TEST_KEY: "k" }));
    const store = new MemorySnapshotStore();
    const r429 = await p.call({
      endpoint: "e",
      request: {},
      ctx: { store, mode: "live" },
      execute: async () => {
        throw new ProviderHttpError(429, "slow", 60_000);
      },
    });
    expect(r429).toMatchObject({ ok: false, reason: "rate_limited", status: 429, retryable: true });
    const r404 = await p.call({
      endpoint: "e",
      request: {},
      ctx: { store, mode: "live" },
      execute: async () => {
        throw new ProviderHttpError(404, "nope");
      },
    });
    expect(r404).toMatchObject({ ok: false, reason: "http_error", status: 404, retryable: false });
    expect(store.rows).toHaveLength(0);
  });

  it("live mode: a stub adapter reports not_implemented", async () => {
    const p = createProvider(def({ TEST_KEY: "k" }));
    const res = await p.call({
      endpoint: "e",
      request: {},
      ctx: { store: new MemorySnapshotStore(), mode: "live" },
      execute: async () => {
        throw new ProviderNotImplemented("website", "e", "2");
      },
    });
    expect(res).toMatchObject({ ok: false, reason: "not_implemented" });
  });

  it("schema failures become parse_failed; classify can flag a successful response", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const p = createProvider(def({ TEST_KEY: "k" }));
    const bad = await p.call({
      endpoint: "e",
      request: { a: 1 },
      ctx: { store: new MemorySnapshotStore(), mode: "live" },
      execute: async () => ({ response: { value: "not a number" } as unknown as { value: number }, costUsd: 0 }),
      schema: Schema,
    });
    expect(bad).toMatchObject({ ok: false, reason: "parse_failed" });

    const flagged = await p.call({
      endpoint: "e",
      request: { a: 2 },
      ctx: { store: new MemorySnapshotStore(), mode: "live" },
      execute: async () => ({ response: { value: -1 }, costUsd: 0 }),
      schema: Schema,
      classify: (r) => (r.value < 0 ? { reason: "refusal", message: "negative" } : null),
    });
    expect(flagged).toMatchObject({ ok: false, reason: "refusal", message: "negative" });
  });

  it("programmer errors propagate instead of becoming UNAVAILABLE", async () => {
    const p = createProvider(def({ TEST_KEY: "k" }));
    await expect(
      p.call({
        endpoint: "e",
        request: {},
        ctx: { store: new MemorySnapshotStore(), mode: "live" },
        execute: async () => {
          throw new TypeError("bug");
        },
      }),
    ).rejects.toBeInstanceOf(TypeError);
  });
});
