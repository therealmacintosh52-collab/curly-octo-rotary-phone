// Regression for the flaky "dealer approves an add-on" step (P9-003).
// Root cause: the Approve button is server-rendered enabled; a click that lands before React hydrates has no handler and is silently lost.
// The old script then waited for the text "Approved", which the account badge in the layout already shows, so it passed vacuously and the
// add-on stayed unapproved (no history row, balance missing the $85). Now the button is disabled until hydration, and this test proves
// (1) a click with no JS changes nothing on the server, (2) after hydration one click approves exactly once, (3) the state survives a reload.
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

const VIN = '1HGCM82633A004352';

async function setup(dealer: Page, owner: Page, stamp: string) {
  const baseURL = test.info().project.use.baseURL as string;
  const headers = { Origin: new URL(baseURL).origin };
  // dealer signs up (demo auth) -> cookie lands in the dealer context
  const su = await dealer.request.post('/api/dealers/auth/signup', {
    headers,
    data: { businessName: `Addon Motors ${stamp}`, contactName: 'Pat Manager', email: `pat-${stamp}@e2e.example`, phone: '916 555 0123', lotAddresses: ['1 Auto Mall Dr, Roseville, CA 95661'], apEmail: `ap-${stamp}@e2e.example`, netTermsRequested: false },
  });
  expect(su.status(), await su.text()).toBeLessThan(300);
  // owner approves the account in the admin UI
  await owner.goto('/admin/login');
  await owner.getByRole('button', { name: /DEMO Owner/ }).click();
  await owner.waitForURL((u: URL) => !u.pathname.endsWith('/login'));
  await owner.goto('/admin/dealers', { waitUntil: 'load' });
  await owner.getByRole('link', { name: new RegExp(`Addon Motors ${stamp}`) }).click();
  await owner.getByRole('button', { name: 'Approve account' }).click();
  await owner.getByRole('button', { name: 'Pause account' }).waitFor();
  const dealerAdmin = new URL(owner.url()).pathname;
  // dealer submits one car
  const v = await dealer.request.post('/api/dealers/vehicles', { headers, data: { csv: `vin,stock_number,services\n${VIN},ADDON-${stamp},dent` } });
  expect(v.status(), await v.text()).toBeLessThan(300);
  // owner proposes a priced add-on on it
  await owner.goto(dealerAdmin, { waitUntil: 'load' });
  const card = owner.locator('.adm-card', { hasText: `stock ADDON-${stamp}` }).first();
  await card.getByText('Propose an add-on').click();
  await card.getByLabel('What').fill('Additional panel: right fender');
  await card.getByLabel('Price (blank = draft)').fill('85');
  await card.getByRole('button', { name: 'Propose' }).click();
  await card.getByText(/Sent to the dealer for approval/).waitFor();
}

test.describe('dealer add-on approval', () => {
  test('a click before hydration is refused (button disabled, nothing changes); after hydration one click approves exactly once and it persists', async ({ browser }) => {
    test.setTimeout(120_000);
    const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
    const baseURL = test.info().project.use.baseURL as string;
    const mk = async () => { const c = await browser.newContext({ baseURL, extraHTTPHeaders: { 'x-forwarded-for': ip }, viewport: { width: 1024, height: 800 }, serviceWorkers: 'block' }); return { c, p: await c.newPage() }; };
    const d = await mk(); const o = await mk();
    try {
      await setup(d.p, o.p, stamp);
      await d.p.goto('/dealers/dashboard', { waitUntil: 'networkidle' });
      await d.p.getByRole('link', { name: /Additional panel: right fender/ }).click();
      const decision = d.p.locator('section[aria-labelledby="ad-h"]');
      await expect(decision.getByText('Waiting for your decision')).toBeVisible();
      await expect(decision.getByRole('button', { name: /Approve add-on/ })).toBeEnabled(); // hydrated

      // 1) no JS: the server HTML must not offer a live button, and forcing a click must not reach the server
      const vehicleUrl = d.p.url();
      const calls: string[] = [];
      d.p.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/addons/')) calls.push(r.url()); });
      await d.p.route(/\/_next\/static\/.*\.js/, (r) => r.abort());
      await d.p.goto(vehicleUrl, { waitUntil: 'domcontentloaded' });
      const btn = decision.getByRole('button', { name: /Approve add-on/ });
      await expect(btn).toBeDisabled();
      await expect(decision.locator('[data-hydrated]')).toHaveAttribute('data-hydrated', 'false');
      await btn.click({ force: true });
      await d.p.waitForTimeout(500);
      expect(calls).toEqual([]);
      await d.p.unroute(/\/_next\/static\/.*\.js/);

      // 2) with JS: wait for the real, enabled button; one click -> approved; the scoped assertion cannot be satisfied by the account badge
      await d.p.goto(vehicleUrl, { waitUntil: 'load' });
      const live = decision.getByRole('button', { name: /Approve add-on/ });
      await expect(live).toBeEnabled();
      await live.click();
      await expect(decision.getByText('Approved', { exact: true })).toBeVisible();
      await expect(decision.getByRole('button', { name: /Approve add-on/ })).toHaveCount(0);
      expect(calls).toHaveLength(1);

      // 3) persisted server-side: history row and no pending approval after a hard reload
      await d.p.reload({ waitUntil: 'networkidle' });
      await expect(decision.getByText('Approved', { exact: true })).toBeVisible();
      await expect(d.p.locator('#main')).toContainText('Add-on approved');
      await expect(decision.getByText('Waiting for your decision')).toHaveCount(0);
    } finally { await d.c.close(); await o.c.close(); }
  });
});
