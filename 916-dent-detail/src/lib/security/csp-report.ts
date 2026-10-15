// Turn a raw CSP report (legacy `{ "csp-report": {...} }` or Reporting API `[{ type: "csp-violation", body }]`) into a log-safe record:
// origin + path only (no query strings or fragments), a directive name, nothing else.
export type CspRecord = { directive: string; blocked: string; page: string; disposition: 'report' | 'enforce' };

const strip = (v: unknown): string => {
  if (typeof v !== 'string') return '';
  try { const u = new URL(v); return `${u.origin}${u.pathname}`.slice(0, 160); } catch { return v.replace(/[^\w:.-]/g, '').slice(0, 30); }
};
const dir = (v: unknown) => (typeof v === 'string' ? (v.split(' ')[0] ?? '').replace(/[^a-z-]/gi, '').slice(0, 40) : '');

export function sanitizeReport(raw: unknown): CspRecord[] {
  const items: unknown[] = Array.isArray(raw) ? raw : [raw];
  const out: CspRecord[] = [];
  for (const it of items.slice(0, 5)) {
    const o = it as { 'csp-report'?: Record<string, unknown>; body?: Record<string, unknown>; type?: string } | null;
    const b = (o?.['csp-report'] ?? (o?.type === 'csp-violation' ? o.body : null)) as Record<string, unknown> | null;
    if (!b || typeof b !== 'object') continue;
    out.push({
      directive: dir(b['effective-directive'] ?? b['effectiveDirective'] ?? b['violated-directive']),
      blocked: strip(b['blocked-uri'] ?? b['blockedURL'] ?? b['blocked-url']),
      page: strip(b['document-uri'] ?? b['documentURL']),
      disposition: b['disposition'] === 'report' ? 'report' : 'enforce',
    });
  }
  return out;
}
