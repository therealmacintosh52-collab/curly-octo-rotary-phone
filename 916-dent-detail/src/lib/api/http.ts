// Small helpers shared by route handlers: JSON responses, zod body parsing, client IP, rate limiting.
import { NextResponse } from 'next/server';
import { z, type ZodType } from 'zod';

export const noStore = { 'Cache-Control': 'no-store' };
export const ok = <T,>(data: T, init: ResponseInit = {}) => NextResponse.json(data, { ...init, headers: { ...noStore, ...(init.headers ?? {}) } });
export const fail = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error: { code, message, ...extra } }, { status, headers: noStore });

export async function parseJson<T>(req: Request, schema: ZodType<T>, maxBytes = 64_000): Promise<{ ok: true; data: T } | { ok: false; res: NextResponse }> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > maxBytes) return { ok: false, res: fail(413, 'too_large', 'Request too large.') };
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > maxBytes) return { ok: false, res: fail(413, 'too_large', 'Request too large.') };
    raw = JSON.parse(text);
  } catch {
    return { ok: false, res: fail(400, 'bad_json', 'Invalid JSON.') };
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    return { ok: false, res: fail(400, 'invalid_input', 'Some fields are invalid.', { fields: r.error.issues.slice(0, 10).map((i) => ({ path: i.path.join('.'), message: i.message })) }) };
  }
  return { ok: true, data: r.data };
}

/**
 * Upload routes: a multipart body must declare its size (browsers always do) and stay under the cap BEFORE it is buffered by
 * `req.formData()`. A chunked/unsized body would otherwise be read in full first. Returns a response to send, or null to go on.
 */
export function requireContentLength(req: Request, maxBytes: number): NextResponse | null {
  const raw = req.headers.get('content-length');
  const len = raw === null ? NaN : Number(raw);
  if (!Number.isFinite(len) || len < 0) return fail(411, 'length_required', 'Content-Length is required.');
  if (len > maxBytes) return fail(413, 'too_large', 'That upload is too large.');
  return null;
}

export function clientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for');
  return (xf?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown').trim();
}

// ---- rate limiting: in-memory fixed window; Upstash REST when configured (works across serverless instances)
type Bucket = { n: number; reset: number };
const G = globalThis as unknown as { __rl?: Map<string, Bucket> };

export async function rateLimit(key: string, limit: number, windowSec: number): Promise<{ ok: boolean; retryAfter: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      const k = `rl:${key}`;
      const r = await fetch(`${url}/pipeline`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([['INCR', k], ['EXPIRE', k, String(windowSec), 'NX']]),
      });
      const j = (await r.json()) as { result: number }[];
      const n = Number(j[0]?.result ?? 0);
      return { ok: n <= limit, retryAfter: windowSec };
    } catch { /* fall through to memory */ }
  }
  const m = (G.__rl ??= new Map());
  const now = Date.now();
  let b = m.get(key);
  if (!b || b.reset <= now) { b = { n: 0, reset: now + windowSec * 1000 }; m.set(key, b); }
  b.n++;
  if (m.size > 5000) for (const [k, v] of m) if (v.reset <= now) m.delete(k);
  return { ok: b.n <= limit, retryAfter: Math.ceil((b.reset - now) / 1000) };
}

export async function limited(req: Request, name: string, limit: number, windowSec: number): Promise<NextResponse | null> {
  const r = await rateLimit(`${name}:${clientIp(req)}`, limit, windowSec);
  if (r.ok) return null;
  const res = fail(429, 'rate_limited', 'Too many requests. Please wait a moment and try again.');
  res.headers.set('Retry-After', String(r.retryAfter));
  return res;
}

export const zIsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

import { log } from './log';
/** Wrap a handler: maps BookingError-like errors (code/status) to JSON, everything else to a generic 500 with no PII. */
export async function guard(name: string, fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try { return await fn(); }
  catch (e) {
    const err = e as { name?: string; code?: string; status?: number; message?: string };
    if (err.name === 'BookingError' && err.status) return fail(err.status, err.code ?? 'error', err.message ?? 'Request failed.');
    log('error', `${name}.unhandled`, { error: err.name, detail: err.message?.slice(0, 120) });
    return fail(500, 'server_error', 'Something went wrong. Please try again or text us.');
  }
}
