// Rate-limit abstraction (memory + Upstash adapter with an injected fetch) and the trusted-proxy client-IP policy.
import { describe, expect, it, vi } from 'vitest';
import { MemoryStore, ResilientLimiter, UpstashStore, createLimiter } from '@/lib/security/rate-limit';
import { clientIpFrom, trustMode } from '@/lib/security/client-ip';

const hdr = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null });

describe('MemoryStore', () => {
  it('allows `limit` hits per window, then refuses with a Retry-After that counts down, then resets', async () => {
    let t = 1_000_000;
    const s = new MemoryStore(() => t);
    for (let i = 0; i < 3; i++) expect((await s.hit('k', 3, 60)).ok).toBe(true);
    const over = await s.hit('k', 3, 60);
    expect(over.ok).toBe(false);
    expect(over.retryAfter).toBe(60);
    t += 45_000;
    expect((await s.hit('k', 3, 60)).retryAfter).toBe(15);
    t += 16_000;
    expect((await s.hit('k', 3, 60)).ok).toBe(true);
  });
  it('keys are independent and expired buckets are swept once the map is large', async () => {
    let t = 0;
    const s = new MemoryStore(() => t, 10);
    for (let i = 0; i < 10; i++) await s.hit(`a${i}`, 1, 1);
    t += 5000;
    await s.hit('fresh', 1, 1);
    expect(s.size).toBeLessThanOrEqual(2);
    expect((await s.hit('a1', 1, 1)).ok).toBe(true);
  });
});

describe('UpstashStore', () => {
  const reply = (n: number, ttl: number) => new Response(JSON.stringify([{ result: n }, { result: 1 }, { result: ttl }]), { status: 200 });
  it('sends INCR + EXPIRE NX + PTTL with the bearer token and maps the answer', async () => {
    const f = vi.fn(async () => reply(4, 12_340)) as unknown as typeof fetch;
    const s = new UpstashStore({ url: 'https://u.example/', token: 'tok', fetchImpl: f });
    const r = await s.hit('chat:1.2.3.4', 3, 600);
    expect(r).toEqual({ ok: false, retryAfter: 13 });
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(url).toBe('https://u.example/pipeline');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body as string)).toEqual([['INCR', 'rl:chat:1.2.3.4'], ['EXPIRE', 'rl:chat:1.2.3.4', '600', 'NX'], ['PTTL', 'rl:chat:1.2.3.4']]);
    expect((await new UpstashStore({ url: 'https://u.example', token: 't', fetchImpl: (async () => reply(3, -1)) as unknown as typeof fetch }).hit('k', 3, 600))).toEqual({ ok: true, retryAfter: 600 });
  });
  it('throws on HTTP errors and malformed bodies so the caller can fall back', async () => {
    const bad = (r: Response) => new UpstashStore({ url: 'https://u.example', token: 't', fetchImpl: (async () => r) as unknown as typeof fetch }).hit('k', 1, 1);
    await expect(bad(new Response('no', { status: 500 }))).rejects.toThrow();
    await expect(bad(new Response('{"x":1}', { status: 200 }))).rejects.toThrow();
    await expect(bad(new Response(JSON.stringify([{ error: 'WRONGPASS' }]), { status: 200 }))).rejects.toThrow();
  });
});

describe('ResilientLimiter / createLimiter', () => {
  it('is memory-only without both env vars', async () => {
    const f = vi.fn();
    const l = createLimiter({ UPSTASH_REDIS_REST_URL: 'https://u.example' }, { fetchImpl: f as unknown as typeof fetch });
    expect((await l.hit('k', 1, 10)).ok).toBe(true);
    expect((await l.hit('k', 1, 10)).ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it('uses Upstash when configured; on failure it limits in memory, skips Upstash for the cool-off, then retries it', async () => {
    let t = 0; let fail = true; const errs: unknown[] = [];
    const f = vi.fn(async () => { if (fail) throw new Error('boom'); return new Response(JSON.stringify([{ result: 1 }, { result: 1 }, { result: 5000 }]), { status: 200 }); });
    const l = createLimiter({ UPSTASH_REDIS_REST_URL: 'https://u.example', UPSTASH_REDIS_REST_TOKEN: 't' }, { fetchImpl: f as unknown as typeof fetch, now: () => t, onError: (e) => errs.push(e) });
    expect((await l.hit('k', 2, 60)).ok).toBe(true);           // upstash fails -> memory hit 1
    expect(l.degraded).toBe(true); expect(errs).toHaveLength(1);
    expect((await l.hit('k', 2, 60)).ok).toBe(true);           // memory hit 2, upstash NOT called again
    expect((await l.hit('k', 2, 60)).ok).toBe(false);          // memory hit 3 -> limited even though Upstash is down
    expect(f).toHaveBeenCalledTimes(1);
    t += 31_000; fail = false;
    expect(l.degraded).toBe(false);
    expect(await l.hit('other', 2, 60)).toEqual({ ok: true, retryAfter: 5 });
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('a custom primary that always works is the only store consulted', async () => {
    const p = { hit: vi.fn(async () => ({ ok: true, retryAfter: 1 })) };
    const fb = { hit: vi.fn(async () => ({ ok: false, retryAfter: 1 })) };
    expect((await new ResilientLimiter(p, fb).hit('k', 1, 1)).ok).toBe(true);
    expect(fb.hit).not.toHaveBeenCalled();
  });
});

describe('client IP policy (O-02)', () => {
  const xff = (v: string) => hdr({ 'x-forwarded-for': v });
  it('Vercel mode trusts x-real-ip, then the first x-forwarded-for entry', () => {
    const env = { TRUST_PROXY: 'vercel' };
    expect(clientIpFrom(hdr({ 'x-real-ip': '203.0.113.9', 'x-forwarded-for': '6.6.6.6, 203.0.113.9' }), env)).toBe('203.0.113.9');
    expect(clientIpFrom(xff('203.0.113.9, 10.0.0.1'), env)).toBe('203.0.113.9');
    expect(trustMode({ VERCEL: '1' })).toEqual({ kind: 'vercel' });
  });
  it('hops:N takes the Nth entry from the right, so a client-forged prefix is ignored', () => {
    expect(clientIpFrom(xff('6.6.6.6, 198.51.100.7'), { TRUST_PROXY: 'hops:1' })).toBe('198.51.100.7');
    expect(clientIpFrom(xff('6.6.6.6, 198.51.100.7, 10.0.0.2'), { TRUST_PROXY: 'hops:2' })).toBe('198.51.100.7');
    expect(clientIpFrom(xff('10.0.0.2'), { TRUST_PROXY: 'hops:2' })).toBe('unknown'); // fewer entries than trusted hops: do not guess
  });
  it('production off Vercel defaults to hops:1; dev/test uses the first entry; none ignores headers', () => {
    expect(trustMode({ NODE_ENV: 'production' })).toEqual({ kind: 'hops', n: 1 });
    expect(clientIpFrom(xff('6.6.6.6, 198.51.100.7'), { NODE_ENV: 'production' })).toBe('198.51.100.7');
    expect(clientIpFrom(xff('10.1.2.3, 198.51.100.7'), { NODE_ENV: 'test' })).toBe('10.1.2.3');
    expect(clientIpFrom(xff('10.1.2.3'), { TRUST_PROXY: 'none' })).toBe('unknown');
  });
  it('rejects values that are not IP literals and handles IPv6', () => {
    expect(clientIpFrom(xff('<script>, evil'), { NODE_ENV: 'test' })).toBe('unknown');
    expect(clientIpFrom(xff('999.1.1.1'), { NODE_ENV: 'test' })).toBe('unknown');
    expect(clientIpFrom(xff('2001:db8::1'), { NODE_ENV: 'test' })).toBe('2001:db8::1');
    expect(clientIpFrom(hdr({}), { NODE_ENV: 'test' })).toBe('unknown');
  });
});
