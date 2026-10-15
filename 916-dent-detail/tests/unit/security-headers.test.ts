// CSP + header policy (SECURITY.md O-01): what the policy allows is derived from env, so these tests pin the contract.
import { describe, expect, it } from 'vitest';
import { buildCsp, pdfHeaders, securityHeaders, tokenPageHeaders } from '@/config/security-headers';
import { sanitizeReport } from '@/lib/security/csp-report';
import { POST as cspPost } from '@/app/api/csp-report/route';

const prod = { NODE_ENV: 'production' };
const dirs = (csp: string) => Object.fromEntries(csp.split('; ').map((d) => [d.split(' ')[0]!, d.split(' ').slice(1)]));

describe('buildCsp', () => {
  it('with no trackers configured, no tracker host is allowed anywhere', () => {
    const csp = buildCsp(prod);
    expect(csp).not.toMatch(/google|facebook|doubleclick/);
    const d = dirs(csp);
    expect(d['default-src']).toEqual(["'self'"]);
    expect(d['object-src']).toEqual(["'none'"]);
    expect(d['base-uri']).toEqual(["'self'"]);
    expect(d['frame-ancestors']).toEqual(["'self'"]);
    expect(d['frame-src']).toEqual(['https://js.stripe.com', 'https://hooks.stripe.com']);
    expect(d['script-src']).toContain('https://js.stripe.com');
    expect(d['script-src']).not.toContain("'unsafe-eval'");
    expect(d['report-uri']).toEqual(['/api/csp-report']);
  });
  it("allows only the hosts of the trackers that are configured, and 'unsafe-eval' only outside production", () => {
    const ga = dirs(buildCsp({ ...prod, NEXT_PUBLIC_GA4_ID: 'G-X' }));
    expect(ga['script-src']).toContain('https://www.googletagmanager.com');
    expect(ga['script-src']).not.toContain('https://connect.facebook.net');
    const meta = dirs(buildCsp({ ...prod, NEXT_PUBLIC_META_PIXEL_ID: '1' }));
    expect(meta['script-src']).toContain('https://connect.facebook.net');
    expect(meta['script-src']).not.toContain('https://www.googletagmanager.com');
    expect(dirs(buildCsp({ NODE_ENV: 'development' }))['script-src']).toContain("'unsafe-eval'");
  });
  it('adds the Supabase origin (signed photo URLs) to img-src and connect-src only when configured', () => {
    const d = dirs(buildCsp({ ...prod, NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co/rest/v1/' }));
    expect(d['img-src']).toContain('https://abc.supabase.co');
    expect(d['connect-src']).toContain('https://abc.supabase.co');
    expect(buildCsp({ ...prod, NEXT_PUBLIC_SUPABASE_URL: 'not a url' })).not.toContain('supabase');
  });
  it('never contains a wildcard script source, data: scripts or http: sources', () => {
    const d = dirs(buildCsp({ ...prod, NEXT_PUBLIC_GA4_ID: 'G-X', NEXT_PUBLIC_META_PIXEL_ID: '1', NEXT_PUBLIC_GADS_ID: 'AW-1' }));
    expect(d['script-src']!.some((s) => s === '*' || s.startsWith('data:') || s.startsWith('http:'))).toBe(false);
    expect(Object.values(d).flat().some((s) => s.startsWith('http:'))).toBe(false);
  });
});

describe('securityHeaders / mode', () => {
  const keys = (h: { key: string }[]) => h.map((x) => x.key);
  it('enforces by default; report-only and off are switchable', () => {
    expect(keys(securityHeaders(prod))).toContain('Content-Security-Policy');
    expect(keys(securityHeaders({ ...prod, CSP_MODE: 'report-only' }))).toContain('Content-Security-Policy-Report-Only');
    expect(keys(securityHeaders({ ...prod, CSP_MODE: 'report-only' }))).not.toContain('Content-Security-Policy');
    expect(keys(securityHeaders({ ...prod, CSP_MODE: 'off' })).some((k) => k.startsWith('Content-Security-Policy'))).toBe(false);
  });
  it('carries the baseline set, HSTS without preload, and no COOP (it cost lab LCP)', () => {
    const h = Object.fromEntries(securityHeaders(prod).map((x) => [x.key, x.value]));
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(h['Strict-Transport-Security']).toMatch(/max-age=63072000/);
    expect(h['Strict-Transport-Security']).not.toMatch(/preload/);
    expect(h['Permissions-Policy']).toMatch(/camera=\(self\)/);
    expect(h['Permissions-Policy']).toMatch(/microphone=\(\)/);
    expect(h['Cross-Origin-Opener-Policy']).toBeUndefined();
  });
  it('token pages are no-store, no-referrer, noindex; PDFs only get the framing rule', () => {
    const t = Object.fromEntries(tokenPageHeaders.map((x) => [x.key, x.value]));
    expect(t['Cache-Control']).toMatch(/no-store/);
    expect(t['Referrer-Policy']).toBe('no-referrer');
    expect(t['X-Robots-Tag']).toMatch(/noindex/);
    expect(pdfHeaders[0]!.value).not.toMatch(/object-src|default-src/);
  });
});

describe('CSP report intake', () => {
  it('sanitizes legacy and Reporting-API payloads to origin+path and a directive name', () => {
    const legacy = { 'csp-report': { 'document-uri': 'https://x.test/book?token=SECRET#frag', 'blocked-uri': 'https://evil.test/a.js?k=1', 'effective-directive': 'script-src-elem', disposition: 'enforce' } };
    expect(sanitizeReport(legacy)).toEqual([{ directive: 'script-src-elem', blocked: 'https://evil.test/a.js', page: 'https://x.test/book', disposition: 'enforce' }]);
    const api = [{ type: 'csp-violation', body: { documentURL: 'https://x.test/', blockedURL: 'inline', effectiveDirective: 'script-src', disposition: 'report' } }, { type: 'network-error', body: {} }];
    expect(sanitizeReport(api)).toEqual([{ directive: 'script-src', blocked: 'inline', page: 'https://x.test/', disposition: 'report' }]);
    expect(sanitizeReport('junk')).toEqual([]);
    expect(sanitizeReport(Array.from({ length: 20 }, () => legacy))).toHaveLength(5);
  });
  const post = (body: string, ip: string, headers: Record<string, string> = {}) => cspPost(new Request('http://x/api/csp-report', { method: 'POST', body, headers: { 'x-forwarded-for': ip, 'content-type': 'application/csp-report', ...headers } }));
  it('answers 204 to a report, 400 to junk, 413 to a big body, and rate limits', async () => {
    expect((await post(JSON.stringify({ 'csp-report': { 'blocked-uri': 'inline' } }), '10.9.0.1')).status).toBe(204);
    expect((await post('not json', '10.9.0.2')).status).toBe(400);
    expect((await post('x'.repeat(9000), '10.9.0.3')).status).toBe(413);
    let last = 204;
    for (let i = 0; i < 40; i++) last = (await post('{}', '10.9.0.4')).status;
    expect(last).toBe(429);
  });
});
