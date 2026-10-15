// No console errors / uncaught exceptions / failed first-party requests on the key routes.
import { test, expect, exposeFullPage } from './fixtures';

const ROUTES = ['/', '/services', '/services/mobile-detailing', '/areas/roseville', '/pricing', '/reviews', '/dealers', '/book', '/blog', '/blog/can-every-dent-be-fixed-without-paint', '/privacy', '/terms', '/admin/login'];

test.describe('console cleanliness', () => {
  for (const path of ROUTES) {
    test(path, async ({ page }) => {
      const problems: string[] = [];
      page.on('pageerror', (e) => problems.push(`pageerror: ${e}`));
      page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`console.${m.type()}: ${m.text()}`); });
      // Next cancels in-flight <Link> prefetches (?_rsc=) when the page scrolls or navigates: that is not an error
      page.on('requestfailed', (r) => { if (!/favicon/.test(r.url()) && !(/_rsc=/.test(r.url()) && r.failure()?.errorText === 'net::ERR_ABORTED')) problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
      page.on('response', (r) => { if (r.status() >= 400 && new URL(r.url()).origin === new URL(page.url() || 'http://x').origin) problems.push(`http ${r.status()}: ${r.url()}`); });
      await page.goto(path, { waitUntil: 'networkidle' });
      await exposeFullPage(page);
      expect(problems).toEqual([]);
    });
  }
});
