// Which IP do we rate-limit and log? `X-Forwarded-For` is only trustworthy if a proxy we control appends to it, so the policy is
// explicit and testable (SECURITY.md O-02):
//   TRUST_PROXY=vercel   Vercel overwrites the header: use x-real-ip, else the first x-forwarded-for entry (default when VERCEL=1)
//   TRUST_PROXY=hops:N   N trusted proxies append to the header: take the Nth entry from the RIGHT (the client cannot forge those)
//   TRUST_PROXY=none     ignore forwarding headers entirely (one shared bucket: use only when nothing can identify the client)
//   (unset)              dev/test: first entry (tests give every request its own address); production off Vercel: hops:1
// Anything that is not a plausible IPv4/IPv6 literal is treated as "unknown", so a forged header cannot inject arbitrary keys.
export type TrustMode = { kind: 'vercel' } | { kind: 'hops'; n: number } | { kind: 'none' } | { kind: 'first' };

export function trustMode(env: Record<string, string | undefined> = process.env): TrustMode {
  const raw = (env.TRUST_PROXY ?? '').trim().toLowerCase();
  if (raw === 'vercel') return { kind: 'vercel' };
  if (raw === 'none') return { kind: 'none' };
  const m = /^hops:(\d{1,2})$/.exec(raw);
  if (m && Number(m[1]) >= 1) return { kind: 'hops', n: Number(m[1]) };
  if (env.VERCEL === '1') return { kind: 'vercel' };
  if (env.NODE_ENV === 'production') return { kind: 'hops', n: 1 };
  return { kind: 'first' };
}

const V4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const V6 = /^[0-9a-f:.]{2,45}$/i;
export const plausibleIp = (s: string): boolean => (V4.test(s) || (s.includes(':') && V6.test(s)));

export function clientIpFrom(h: { get(name: string): string | null }, env: Record<string, string | undefined> = process.env): string {
  const mode = trustMode(env);
  if (mode.kind === 'none') return 'unknown';
  const list = (h.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  let pick: string | undefined;
  if (mode.kind === 'vercel') pick = h.get('x-real-ip')?.trim() || list[0];
  else if (mode.kind === 'hops') pick = list.length >= mode.n ? list[list.length - mode.n] : undefined;
  else pick = list[0] ?? h.get('x-real-ip')?.trim();
  return pick && plausibleIp(pick) ? pick : 'unknown';
}
