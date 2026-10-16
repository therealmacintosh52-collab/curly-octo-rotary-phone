// SEO smoke on the production build: head tags, JSON-LD, sitemap/robots, redirects, 404, legal pages, no-JS content.
import { test, expect } from './fixtures';

const PAGES = ['/', '/services', '/services/paintless-dent-repair', '/areas', '/areas/folsom', '/pricing', '/dealers', '/book', '/blog', '/blog/can-every-dent-be-fixed-without-paint', '/privacy', '/terms'];

test.describe('seo smoke', () => {
  for (const path of PAGES) {
    test(`head + schema: ${path}`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(res?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      const title = await page.title();
      expect(title.length).toBeGreaterThan(10);
      expect(title.length).toBeLessThanOrEqual(75);
      const desc = await page.locator('meta[name=description]').getAttribute('content');
      expect(desc?.length ?? 0).toBeGreaterThan(40);
      const canonical = await page.locator('link[rel=canonical]').getAttribute('href');
      expect(canonical).toBeTruthy();
      expect(new URL(canonical!, 'http://x').pathname.replace(/\/$/, '') || '/').toBe(path === '/' ? '/' : path);
      await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
      const ld = await page.$$eval('script[type="application/ld+json"]', (n) => n.map((x) => x.textContent ?? ''));
      for (const t of ld) expect(() => JSON.parse(t)).not.toThrow();
      const all = ld.join(' ');
      expect(all).not.toMatch(/aggregateRating|"review"/); // no self-serving ratings
      expect(all).not.toMatch(/streetAddress/); // service-area business: no street address
    });
  }

  test('home has LocalBusiness-family schema; service pages carry Service + FAQPage; city and blog have breadcrumbs', async ({ page }) => {
    const types = async (path: string) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      return (await page.$$eval('script[type="application/ld+json"]', (n) => n.map((x) => x.textContent ?? ''))).join(' ');
    };
    expect(await types('/')).toMatch(/"AutoRepair"|"LocalBusiness"/);
    const svc = await types('/services/paintless-dent-repair');
    expect(svc).toMatch(/"Service"/); expect(svc).toMatch(/"FAQPage"/); expect(svc).toMatch(/"BreadcrumbList"/);
    expect(await types('/areas/folsom')).toMatch(/"BreadcrumbList"/);
    expect(await types('/blog/can-every-dent-be-fixed-without-paint')).toMatch(/"BlogPosting"|"Article"/);
  });

  test('security headers are on every response, including API and 404', async ({ request }) => {
    for (const path of ['/', '/book', '/api/geo/zip?zip=95624', '/this-page-does-not-exist']) {
      const h = (await request.get(path)).headers();
      expect(h['x-content-type-options'], path).toBe('nosniff');
      expect(h['referrer-policy'], path).toBe('strict-origin-when-cross-origin');
      expect(h['x-frame-options'], path).toBe('SAMEORIGIN');
      expect(h['permissions-policy'], path).toContain('microphone=()');
      expect(h['x-powered-by'], path).toBeUndefined();
      expect(h['strict-transport-security'], path).toMatch(/max-age=63072000/);
      const csp = h['content-security-policy'] ?? '';
      expect(csp, path).toContain("default-src 'self'");
      expect(csp, path).toContain("object-src 'none'");
      expect(csp, path).toContain("frame-ancestors 'self'");
      expect(csp, path).toContain('report-uri /api/csp-report');
      expect(h['content-security-policy-report-only'], path).toBeUndefined();
    }
  });

  test('token pages are never cached, never indexed and never leak the URL through Referer; PDFs keep only the framing rule', async ({ request }) => {
    for (const path of ['/booking/not-a-real-token', '/invoice/not-a-real-token']) {
      const h = (await request.get(path)).headers();
      expect(h['cache-control'], path).toMatch(/no-store/);
      expect(h['referrer-policy'], path).toBe('no-referrer');
      expect(h['x-robots-tag'], path).toMatch(/noindex/);
    }
    const pdf = (await request.get('/dealers/leave-behind.pdf')).headers();
    expect(pdf['content-security-policy']).toBe("frame-ancestors 'self'; base-uri 'none'");
  });

  test('the CSP report endpoint takes a report and answers 204', async ({ request, baseURL }) => {
    const r = await request.post('/api/csp-report', { data: { 'csp-report': { 'blocked-uri': 'https://evil.example/x.js?token=SECRET', 'effective-directive': 'script-src-elem', 'document-uri': `${baseURL}/book?x=1` } }, headers: { 'content-type': 'application/csp-report' } });
    expect(r.status()).toBe(204);
  });

  test('robots.txt and sitemap.xml: private areas disallowed, every sitemap URL resolves, no private URL listed', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    for (const d of ['/admin', '/booking/', '/invoice/', '/api/', '/dealers/dashboard']) expect(robots).toContain(`Disallow: ${d}`);
    expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
    const xml = await (await request.get('/sitemap.xml')).text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname);
    expect(urls.length).toBeGreaterThan(40);
    expect(urls).toEqual(expect.arrayContaining(['/', '/book', '/privacy', '/terms']));
    for (const u of urls) expect(u).not.toMatch(/^\/(admin|api|booking|invoice|dealers\/dashboard)/);
    for (const u of urls) expect((await request.get(u, { maxRedirects: 0 })).status(), u).toBe(200);
  });

  test('unknown URL is a real 404; legacy URL redirects permanently', async ({ request, page }) => {
    expect((await request.get('/this-page-does-not-exist')).status()).toBe(404);
    const r = await request.get('/contact', { maxRedirects: 0 });
    expect([301, 308]).toContain(r.status());
    await page.goto('/this-page-does-not-exist');
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
  });

  test('legal pages are marked as templates for counsel and carry SMS program disclosures', async ({ page }) => {
    await page.goto('/terms');
    const t = await page.locator('main').innerText();
    for (const re of [/Template, not legal advice/i, /message frequency varies/i, /message and data rates may apply/i, /reply STOP/i, /reply HELP/i, /not a condition of purchase/i, /REMIND ME/]) expect(t).toMatch(re);
    await page.goto('/privacy');
    const p = await page.locator('main').innerText();
    expect(p).toMatch(/Template, not legal advice/i);
    expect(p).toMatch(/days after the last message/i);
    expect(p).not.toMatch(/\bcompliant\b|complies with/i);
    await expect(page.getByRole('link', { name: 'Privacy', exact: true }).first()).toBeVisible();
  });

  test('critical content is in the server HTML (works with JavaScript off)', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('h1')).toContainText(/Dents gone/i);
    await expect(page.getByText('Mobile paintless dent repair & detailing across Sacramento.').first()).toBeAttached();
    await ctx.close();
  });
});
