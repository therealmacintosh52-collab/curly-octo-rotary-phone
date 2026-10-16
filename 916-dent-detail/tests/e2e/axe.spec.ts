// axe-core on every public route class + the private surfaces (admin, dealer pages): 0 serious/critical, no horizontal overflow.
import { test, expect, axeSerious, exposeFullPage } from './fixtures';

const PUBLIC = [
  '/', '/services', '/services/paintless-dent-repair', '/services/ceramic-coating', '/areas', '/areas/elk-grove', '/pricing', '/reviews', '/dealers', '/dealers/signup',
  '/dealers/signin', '/book', '/blog', '/blog/can-every-dent-be-fixed-without-paint', '/privacy', '/terms', '/this-page-does-not-exist', '/booking/not-a-real-token',
];
const ADMIN = ['/admin/login', '/admin', '/admin/today', '/admin/pipeline', '/admin/schedule', '/admin/customers', '/admin/reports', '/admin/invoices', '/admin/memberships', '/admin/referrals', '/admin/inbox', '/admin/more', '/admin/dealers'];

test.describe('axe: public routes', () => {
  for (const path of PUBLIC) {
    test(path, async ({ page }) => {
      await page.goto(path, { waitUntil: 'load' });
      await page.waitForTimeout(500);
      await exposeFullPage(page);
      expect(await axeSerious(page)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
    });
  }
});

test.describe('axe: admin (demo login)', () => {
  test('every admin screen', async ({ page }) => {
    await page.goto('/admin/login');
    expect(await axeSerious(page)).toEqual([]);
    await page.getByRole('button', { name: /DEMO Owner/ }).click();
    await page.waitForURL((u) => !u.pathname.endsWith('/login'));
    for (const path of ADMIN.slice(1)) {
      await page.goto(path, { waitUntil: 'load' });
      await page.waitForTimeout(400);
      expect(await axeSerious(page), path).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), `${path} overflow`).toBe(false);
    }
  });
});

test.describe('axe: dealer portal (demo account)', () => {
  test('signup, pending dashboard, submit, vehicles, billing', async ({ page }) => {
    const stamp = Date.now().toString(36);
    await page.goto('/dealers/signup', { waitUntil: 'networkidle' });
    await page.getByLabel('Business name').fill(`Axe Motors ${stamp}`);
    await page.getByLabel('Your name').fill('Ada Axe');
    await page.getByLabel('Phone').fill('916 555 0188');
    await page.getByLabel('Your email').fill(`ada-${stamp}@e2e.example`);
    await page.locator('#lot0').fill('9 Auto Mall Dr, Roseville, CA 95661');
    await page.getByLabel('Accounts payable email').fill(`ap-${stamp}@e2e.example`);
    await page.getByLabel(/Expected vehicles per month/).fill('10');
    await page.getByRole('button', { name: 'Create dealer account' }).click();
    await page.waitForURL('**/dealers/dashboard');
    for (const path of ['/dealers/dashboard', '/dealers/dashboard/submit', '/dealers/dashboard/vehicles', '/dealers/dashboard/billing']) {
      await page.goto(path, { waitUntil: 'networkidle' });
      expect(await axeSerious(page), path).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), `${path} overflow`).toBe(false);
    }
  });
});
