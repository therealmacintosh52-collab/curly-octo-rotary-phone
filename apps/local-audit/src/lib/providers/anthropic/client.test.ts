import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { MemorySnapshotStore } from "../core";
import { createAnthropicProvider, mapAnthropicError, type AnthropicSdk } from "./client";
import { costFromUsage } from "./pricing";

const usage = (over: Partial<Anthropic.Usage> = {}): Anthropic.Usage =>
  ({
    input_tokens: 1000,
    output_tokens: 100,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    ...over,
  }) as Anthropic.Usage;

function stubSdk(create: unknown, parse: unknown = vi.fn()): AnthropicSdk {
  return { messages: { create, parse } } as unknown as AnthropicSdk;
}

const env = { ANTHROPIC_API_KEY: "test-key" };
const live = () => ({ store: new MemorySnapshotStore(), mode: "live" as const });

describe("costFromUsage", () => {
  it("prices input, output, cache write and cache read tokens", () => {
    // 1M input = $5, 1M output = $25, cache write 1.25x, cache read 0.1x
    expect(costFromUsage({ input_tokens: 1_000_000, output_tokens: 0 })).toBe(5);
    expect(costFromUsage({ input_tokens: 0, output_tokens: 1_000_000 })).toBe(25);
    expect(costFromUsage({ input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 1_000_000 })).toBe(6.25);
    expect(costFromUsage({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1_000_000 })).toBe(0.5);
    expect(costFromUsage({ input_tokens: 1000, output_tokens: 100 })).toBe(0.0075);
  });
});

describe("anthropic.complete", () => {
  it("calls messages.create with claude-opus-5 and no thinking key, returns text + cost", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const create = vi.fn<(params: unknown) => Promise<unknown>>(async () => ({
      content: [{ type: "text", text: "Hello" }],
      stop_reason: "end_turn",
      stop_details: null,
      usage: usage(),
    }));
    const a = createAnthropicProvider({ sdk: stubSdk(create), env });
    const res = await a.complete({ system: "sys", messages: [{ role: "user", content: "hi" }], effort: "low" }, live());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.text).toBe("Hello");
      expect(res.meta.cost_usd).toBe(0.0075);
    }
    const params = create.mock.calls[0]![0] as Record<string, unknown>;
    expect(params.model).toBe("claude-opus-5");
    expect(params.max_tokens).toBe(16_000);
    expect(params.output_config).toEqual({ effort: "low" });
    expect(params).not.toHaveProperty("thinking");
  });

  it("maps a refusal stop reason to UNAVAILABLE refusal with the category", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const create = vi.fn(async () => ({ content: [], stop_reason: "refusal", stop_details: { type: "refusal", category: "cyber" }, usage: usage() }));
    const a = createAnthropicProvider({ sdk: stubSdk(create), env });
    const res = await a.complete({ messages: [{ role: "user", content: "x" }] }, live());
    expect(res).toMatchObject({ ok: false, reason: "refusal" });
    expect(!res.ok && res.message).toContain("cyber");
  });

  it("maps max_tokens to truncated", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const create = vi.fn(async () => ({ content: [{ type: "text", text: "partial" }], stop_reason: "max_tokens", stop_details: null, usage: usage() }));
    const a = createAnthropicProvider({ sdk: stubSdk(create), env });
    const res = await a.complete({ messages: [{ role: "user", content: "x" }] }, live());
    expect(res).toMatchObject({ ok: false, reason: "truncated" });
  });

  it("retries a 429 once using the SDK error class, then succeeds", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    let n = 0;
    const create = vi.fn(async () => {
      if (n++ === 0) {
        throw new Anthropic.RateLimitError(429, { type: "error", error: { type: "rate_limit_error", message: "slow" } }, "slow", new Headers({ "retry-after": "0" }));
      }
      return { content: [{ type: "text", text: "ok" }], stop_reason: "end_turn", stop_details: null, usage: usage() };
    });
    const a = createAnthropicProvider({ sdk: stubSdk(create), env });
    // Speed the retry up: patch the provider's retry options through the definition.
    a.provider.definition.retry = { sleep: async () => {}, random: () => 0 };
    const res = await a.complete({ messages: [{ role: "user", content: "x" }] }, live());
    expect(res.ok && res.meta.attempts).toBe(2);
  });

  it("mock mode serves the fixture without touching the SDK", async () => {
    const create = vi.fn();
    const a = createAnthropicProvider({ sdk: stubSdk(create), env: {} });
    const res = await a.complete({ messages: [{ role: "user", content: "x" }] }, { store: new MemorySnapshotStore(), mode: "mock" });
    expect(res.ok).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("anthropic.extract", () => {
  const Trust = z.object({ phone_visible: z.boolean(), rating_badge: z.boolean() });

  it("uses messages.parse with a zod output format and returns validated data", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const parse = vi.fn<(params: unknown) => Promise<unknown>>(async () => ({ parsed_output: { phone_visible: true, rating_badge: false }, stop_reason: "end_turn", stop_details: null, usage: usage() }));
    const a = createAnthropicProvider({ sdk: stubSdk(vi.fn(), parse), env });
    const res = await a.extract({ schema: Trust, schemaName: "trust-v1", messages: [{ role: "user", content: "x" }] }, live());
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.data).toEqual({ phone_visible: true, rating_badge: false });
    const params = parse.mock.calls[0]![0] as { output_config: { format: { type: string } } };
    expect(params.output_config.format.type).toBe("json_schema");
  });

  it("null parsed_output is parse_failed", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const parse = vi.fn(async () => ({ parsed_output: null, stop_reason: "end_turn", stop_details: null, usage: usage() }));
    const a = createAnthropicProvider({ sdk: stubSdk(vi.fn(), parse), env });
    const res = await a.extract({ schema: Trust, schemaName: "trust-v1", messages: [{ role: "user", content: "x" }] }, live());
    expect(res).toMatchObject({ ok: false, reason: "parse_failed" });
  });

  it("validates mock fixtures against the schema too", async () => {
    const Full = z.object({ phone_visible: z.boolean(), rating_badge: z.boolean(), owner_named: z.boolean(), team_photos: z.boolean(), licence_shown: z.boolean() });
    const a = createAnthropicProvider({ sdk: stubSdk(vi.fn(), vi.fn()), env: {} });
    const ok = await a.extract({ schema: Full, schemaName: "trust-signals-v1", messages: [] }, { store: new MemorySnapshotStore(), mode: "mock" });
    expect(ok.ok).toBe(true);
    const Wrong = z.object({ something_else: z.string() });
    const bad = await a.extract({ schema: Wrong, schemaName: "trust-signals-v1", messages: [] }, { store: new MemorySnapshotStore(), mode: "mock" });
    expect(bad).toMatchObject({ ok: false, reason: "parse_failed" });
  });
});

describe("mapAnthropicError", () => {
  it("maps SDK error classes to provider errors", () => {
    const rate = mapAnthropicError(new Anthropic.RateLimitError(429, undefined, "r", new Headers({ "retry-after": "2" })));
    expect(rate).toMatchObject({ status: 429, retryable: true, retryAfterMs: 2000 });
    const auth = mapAnthropicError(new Anthropic.AuthenticationError(401, undefined, "a", new Headers()));
    expect(auth).toMatchObject({ status: 401, retryable: false });
    const server = mapAnthropicError(new Anthropic.InternalServerError(503, undefined, "s", new Headers()));
    expect(server).toMatchObject({ status: 503, retryable: true });
    const conn = mapAnthropicError(new Anthropic.APIConnectionError({ message: "down" }));
    expect(conn).toMatchObject({ retryable: true });
    const other = new TypeError("bug");
    expect(mapAnthropicError(other)).toBe(other);
  });
});
