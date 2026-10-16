// Security headers for every response (SECURITY.md O-01 and S-09). Pure functions so they are unit-tested and next.config.ts only wires them in.
//
// CSP design: the site is statically generated, so a per-request nonce (which forces dynamic rendering of every page and costs TTFB/LCP) is
// not used. Next.js, the pre-paint env script and the consent-gated GA/Meta bootstraps are inline, so `script-src` keeps 'unsafe-inline' and
// everything ELSE is locked down: no plugins, no <base> hijack, same-origin forms (plus Stripe's hosts for hosted invoice/portal redirects),
// no framing by other sites, and `connect-src`/`img-src`/`frame-src` limited to the hosts we use. Third-party hosts are only added when the
// matching NEXT_PUBLIC_* id is set at build time, so a site with no trackers allows no tracker host.
// CSP_MODE=enforce (default) | report-only | off.  Violations are POSTed to /api/csp-report (logged, rate limited, no storage).
export type CspEnv = Record<string, string | undefined>;
const CSP_REPORT_PATH = '/api/csp-report';

const uniq = (a: string[]) => [...new Set(a.filter(Boolean))];

export function buildCsp(env: CspEnv = process.env): string {
  const dev = env.NODE_ENV !== 'production';
  const ga = Boolean(env.NEXT_PUBLIC_GA4_ID);
  const ads = Boolean(env.NEXT_PUBLIC_GADS_ID || env.NEXT_PUBLIC_GOOGLE_ADS_ID);
  const meta = Boolean(env.NEXT_PUBLIC_META_PIXEL_ID);
  const supa = env.NEXT_PUBLIC_SUPABASE_URL ? (() => { try { return new URL(env.NEXT_PUBLIC_SUPABASE_URL!).origin; } catch { return ''; } })() : '';
  const google = ga || ads;

  const script = uniq(["'self'", "'unsafe-inline'", dev ? "'unsafe-eval'" : '', 'https://js.stripe.com',
    google ? 'https://www.googletagmanager.com' : '', meta ? 'https://connect.facebook.net' : '']);
  const connect = uniq(["'self'", 'https://api.stripe.com', supa, dev ? 'ws:' : '',
    google ? 'https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://stats.g.doubleclick.net' : '',
    ads ? 'https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com' : '',
    meta ? 'https://www.facebook.com https://connect.facebook.net' : '']);
  const img = uniq(["'self'", 'data:', 'blob:', supa,
    google ? 'https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com' : '',
    ads ? 'https://googleads.g.doubleclick.net https://www.google.com https://www.googleadservices.com' : '',
    meta ? 'https://www.facebook.com' : '']);

  const d: [string, string[]][] = [
    ['default-src', ["'self'"]],
    ['script-src', script],
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['img-src', img],
    ['font-src', ["'self'", 'data:']],
    ['connect-src', connect],
    ['frame-src', ['https://js.stripe.com', 'https://hooks.stripe.com']],
    ['worker-src', ["'self'", 'blob:']],
    ['manifest-src', ["'self'"]],
    ['media-src', ["'self'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    // Chrome applies form-action to redirects after a form POST: the invoice page's server action redirects to Stripe's hosted invoice.
    ['form-action', ["'self'", 'https://*.stripe.com']],
    ['frame-ancestors', ["'self'"]],
    ['report-uri', [CSP_REPORT_PATH]],
    ['report-to', ['csp-endpoint']],
  ];
  return d.map(([k, v]) => `${k} ${v.join(' ')}`).join('; ');
}

export type Header = { key: string; value: string };

export function securityHeaders(env: CspEnv = process.env): Header[] {
  const mode = (env.CSP_MODE ?? 'enforce').toLowerCase();
  const h: Header[] = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
    // camera=(self) is the photo capture; payment only for us and Stripe; everything else off. interest-cohort/browsing-topics opt out of ad-tech cohorts.
    { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(self "https://js.stripe.com"), usb=(), serial=(), accelerometer=(), gyroscope=(), magnetometer=(), interest-cohort=(), browsing-topics=()' },
    // Ignored on plain http (local); on https it pins the site for two years. No `preload`: submitting to the preload list is the owner's call.
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
    { key: 'Reporting-Endpoints', value: `csp-endpoint="${CSP_REPORT_PATH}"` },
  ];
  if (mode !== 'off') h.push({ key: mode === 'report-only' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy', value: buildCsp(env) });
  return h;
}

/** Pages addressed by a bearer token in the URL (booking links, invoice links): never cached, never indexed, never leaked through Referer. */
export const tokenPageHeaders: Header[] = [
  { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
];

/** PDFs are opened in the browser's own viewer, which Chrome has been known to refuse under `object-src`/`default-src` limits: they get only the framing rule. */
export const pdfHeaders: Header[] = [{ key: 'Content-Security-Policy', value: "frame-ancestors 'self'; base-uri 'none'" }];
