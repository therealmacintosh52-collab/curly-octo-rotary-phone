import type { z } from "zod";
import { cacheKey } from "./cache-key";
import { ProviderError, ProviderHttpError, ProviderNotConfigured, ProviderNotImplemented, ProviderParseError, ProviderTimeout } from "./errors";
import { loadFixture, saveFixture } from "./fixtures";
import { providerMode } from "./mode";
import { withRetry, type RetryOptions } from "./retry";
import type { CallContext, CallMeta, EnvLike, ProviderMode, ProviderName, ProviderResult, ProviderStatus, Unavailable, UnavailableReason } from "./types";

export interface ProviderDefinition {
  name: ProviderName;
  label: string;
  docsUrl: string;
  /** Env vars that must all be set for live calls. */
  envKeys: string[];
  timeoutMs: number;
  defaultTtlSeconds: number;
  /** Phase in which live calls are implemented ("0" = now). */
  phase: string;
  retry?: Partial<RetryOptions>;
  env?: EnvLike;
}

export interface ExecuteResult<T> {
  response: T;
  costUsd: number;
}

export interface CallArgs<TReq, TRes> {
  endpoint: string;
  request: TReq;
  ctx: CallContext;
  /** Runs the real call. Receives the timeout budget; throw Provider* errors for failures. */
  execute: (opts: { timeoutMs: number; attempt: number }) => Promise<ExecuteResult<TRes>>;
  /** Zod schema for the response; a failed parse becomes UNAVAILABLE parse_failed. */
  schema?: z.ZodType<TRes>;
  /** Maps a successful raw response to UNAVAILABLE (e.g. an LLM refusal). */
  classify?: (response: TRes) => { reason: UnavailableReason; message: string } | null;
}

export interface ProviderClient {
  readonly name: ProviderName;
  readonly definition: ProviderDefinition;
  isConfigured(): boolean;
  status(): ProviderStatus;
  call<TReq, TRes>(args: CallArgs<TReq, TRes>): Promise<ProviderResult<TRes>>;
}

/**
 * Wraps one external service. `call()` is the single pipeline every request
 * goes through: cache lookup → mode switch → configured? → retry(execute) →
 * validate → persist snapshot + cost → result. Availability problems come back
 * as UNAVAILABLE; only programmer errors throw.
 */
export function createProvider(def: ProviderDefinition): ProviderClient {
  const env = def.env ?? process.env;

  const isConfigured = () => def.envKeys.every((k) => !!env[k]?.trim());

  const status = (): ProviderStatus => ({
    name: def.name,
    label: def.label,
    docsUrl: def.docsUrl,
    envKeys: def.envKeys.map((key) => ({ key, set: !!env[key]?.trim() })),
    configured: isConfigured(),
    mode: providerMode(env),
    phase: def.phase,
  });

  async function call<TReq, TRes>(args: CallArgs<TReq, TRes>): Promise<ProviderResult<TRes>> {
    const started = Date.now();
    const now = args.ctx.now ?? (() => new Date());
    const mode: ProviderMode = args.ctx.mode ?? providerMode(env);
    const key = cacheKey(def.name, args.endpoint, args.request);
    const ttlSeconds = args.ctx.ttlSeconds ?? def.defaultTtlSeconds;

    const meta = (patch: Partial<CallMeta>): CallMeta => ({
      provider: def.name,
      endpoint: args.endpoint,
      cached: false,
      cost_usd: 0,
      duration_ms: Date.now() - started,
      attempts: 0,
      snapshot_id: null,
      mode,
      ...patch,
    });
    const unavailable = (reason: UnavailableReason, message: string, extra: Partial<Unavailable> = {}, m: Partial<CallMeta> = {}): Unavailable => ({
      ok: false,
      kind: "UNAVAILABLE",
      reason,
      message,
      retryable: false,
      ...extra,
      meta: meta(m),
    });

    const finish = (data: TRes, m: Partial<CallMeta>): ProviderResult<TRes> => {
      if (args.schema) {
        const parsed = args.schema.safeParse(data);
        if (!parsed.success) {
          return unavailable("parse_failed", `${def.name}.${args.endpoint}: response did not match schema`, {}, m);
        }
        data = parsed.data;
      }
      const flagged = args.classify?.(data);
      if (flagged) return unavailable(flagged.reason, flagged.message, {}, m);
      return { ok: true, data, meta: meta(m) };
    };

    // 1. Cache (raw_snapshots) — free and mode-independent.
    const hit = await args.ctx.store.findFresh(key, now());
    if (hit) {
      return finish(hit.response as TRes, { cached: true, snapshot_id: hit.id });
    }

    // 2. Mock: fixtures only, never the network.
    if (mode === "mock") {
      const fixture = await loadFixture<TRes>(def.name, args.ctx.fixture ?? args.endpoint);
      if (!fixture) {
        return unavailable("no_fixture", `${def.name}.${args.endpoint}: no fixture "${args.ctx.fixture ?? args.endpoint}" in mock mode`);
      }
      return finish(fixture.response, { cached: true });
    }

    // 3. Live / record.
    if (!isConfigured()) {
      const err = new ProviderNotConfigured(def.label, def.envKeys);
      return unavailable("not_configured", err.message);
    }

    let outcome: { value: ExecuteResult<TRes>; attempts: number };
    try {
      outcome = await withRetry((attempt) => args.execute({ timeoutMs: def.timeoutMs, attempt }), def.retry);
    } catch (err) {
      return mapError(err, unavailable);
    }

    const fetchedAt = now();
    const expiresAt = ttlSeconds > 0 ? new Date(fetchedAt.getTime() + ttlSeconds * 1000).toISOString() : null;
    const saved = await args.ctx.store.save({
      audit_id: args.ctx.auditId ?? null,
      provider: def.name,
      endpoint: args.endpoint,
      cache_key: key,
      request: args.request,
      response: outcome.value.response,
      fetched_at: fetchedAt.toISOString(),
      cost_usd: outcome.value.costUsd,
      expires_at: expiresAt,
    });

    if (mode === "record") {
      await saveFixture(def.name, args.ctx.fixture ?? args.endpoint, {
        request: args.request,
        response: outcome.value.response,
        cost_usd: outcome.value.costUsd,
        recorded_at: fetchedAt.toISOString(),
        note: "recorded from a live call; treat as a sample, not as current data",
      });
    }

    console.info(
      JSON.stringify({
        evt: "provider_cost",
        provider: def.name,
        endpoint: args.endpoint,
        audit_id: args.ctx.auditId ?? null,
        cost_usd: outcome.value.costUsd,
        attempts: outcome.attempts,
        duration_ms: Date.now() - started,
      }),
    );

    return finish(outcome.value.response, { cost_usd: outcome.value.costUsd, attempts: outcome.attempts, snapshot_id: saved.id });
  }

  return { name: def.name, definition: def, isConfigured, status, call };
}

function mapError(err: unknown, unavailable: (reason: UnavailableReason, message: string, extra?: Partial<Unavailable>) => Unavailable): Unavailable {
  if (err instanceof ProviderNotImplemented) return unavailable("not_implemented", err.message);
  if (err instanceof ProviderNotConfigured) return unavailable("not_configured", err.message);
  if (err instanceof ProviderTimeout) return unavailable("timeout", err.message, { retryable: true });
  if (err instanceof ProviderParseError) return unavailable("parse_failed", err.message);
  if (err instanceof ProviderHttpError) {
    if (err.status === 429) return unavailable("rate_limited", err.message, { status: 429, retryable: true });
    return unavailable("http_error", err.message, { status: err.status, retryable: err.retryable });
  }
  if (err instanceof ProviderError) return unavailable(err.retryable ? "network" : "http_error", err.message, { retryable: err.retryable });
  // Anything else is a bug in the adapter, not an availability problem.
  throw err;
}
