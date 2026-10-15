// Rate limiting behind one small interface (SECURITY.md O-02).
//   MemoryStore   fixed window per process: the zero-config default and the fallback
//   UpstashStore  Redis over REST, shared by every serverless instance: enabled by UPSTASH_REDIS_REST_URL + _TOKEN (an account
//                 the owner creates; nothing here calls it unless both are set)
// A failing or slow Upstash never blocks a request and never lets abuse through unchecked: after one failure the limiter falls back to
// the memory store for a cool-off period, then tries Upstash again.
export type RateResult = { ok: boolean; retryAfter: number };
export interface RateLimitStore { hit(key: string, limit: number, windowSec: number): Promise<RateResult> }
type Fetch = typeof fetch;

type Bucket = { n: number; reset: number };

export class MemoryStore implements RateLimitStore {
  private m = new Map<string, Bucket>();
  constructor(private now: () => number = Date.now, private maxKeys = 5000) {}
  async hit(key: string, limit: number, windowSec: number): Promise<RateResult> {
    const now = this.now();
    let b = this.m.get(key);
    if (!b || b.reset <= now) { b = { n: 0, reset: now + windowSec * 1000 }; this.m.set(key, b); }
    b.n++;
    if (this.m.size > this.maxKeys) for (const [k, v] of this.m) if (v.reset <= now) this.m.delete(k);
    return { ok: b.n <= limit, retryAfter: Math.max(1, Math.ceil((b.reset - now) / 1000)) };
  }
  get size() { return this.m.size; }
}

export class UpstashStore implements RateLimitStore {
  constructor(private o: { url: string; token: string; fetchImpl?: Fetch; timeoutMs?: number }) {}
  async hit(key: string, limit: number, windowSec: number): Promise<RateResult> {
    const k = `rl:${key}`;
    const f = this.o.fetchImpl ?? fetch;
    const r = await f(`${this.o.url.replace(/\/+$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.o.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['INCR', k], ['EXPIRE', k, String(windowSec), 'NX'], ['PTTL', k]]),
      signal: AbortSignal.timeout(this.o.timeoutMs ?? 1500),
    });
    if (!r.ok) throw new Error(`upstash ${r.status}`);
    const j = (await r.json()) as { result?: unknown; error?: string }[];
    if (!Array.isArray(j) || j[0]?.error || typeof j[0]?.result !== 'number') throw new Error('upstash bad response');
    const n = j[0].result as number;
    const ttl = Number(j[2]?.result);
    return { ok: n <= limit, retryAfter: Number.isFinite(ttl) && ttl > 0 ? Math.ceil(ttl / 1000) : windowSec };
  }
}

export class ResilientLimiter implements RateLimitStore {
  private downUntil = 0;
  constructor(private primary: RateLimitStore | null, private fallback: RateLimitStore, private now: () => number = Date.now, private coolOffMs = 30_000, private onError?: (e: unknown) => void) {}
  /** true while the primary store is being skipped after a failure */
  get degraded() { return this.now() < this.downUntil; }
  async hit(key: string, limit: number, windowSec: number): Promise<RateResult> {
    if (this.primary && this.now() >= this.downUntil) {
      try { return await this.primary.hit(key, limit, windowSec); }
      catch (e) { this.downUntil = this.now() + this.coolOffMs; this.onError?.(e); }
    }
    return this.fallback.hit(key, limit, windowSec);
  }
}

export function createLimiter(env: Record<string, string | undefined> = process.env, o: { fetchImpl?: Fetch; now?: () => number; onError?: (e: unknown) => void } = {}): ResilientLimiter {
  const url = env.UPSTASH_REDIS_REST_URL, token = env.UPSTASH_REDIS_REST_TOKEN;
  const primary = url && token ? new UpstashStore({ url, token, fetchImpl: o.fetchImpl }) : null;
  return new ResilientLimiter(primary, new MemoryStore(o.now), o.now, 30_000, o.onError);
}

// One process-wide limiter (survives hot reloads); built lazily so env is read at first use.
const G = globalThis as unknown as { __d916Limiter?: ResilientLimiter };
export const limiter = (): ResilientLimiter => (G.__d916Limiter ??= createLimiter(process.env, { onError: (e) => console.warn(JSON.stringify({ level: 'warn', msg: 'ratelimit.upstash_failed', detail: String((e as Error)?.message ?? e).slice(0, 120) })) }));
