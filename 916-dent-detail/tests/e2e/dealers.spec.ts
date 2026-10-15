// Dealer portal smoke in mock mode: landing, signup validation, signup -> pending dashboard, API gate, sign out/in.
import { test, expect, axeSerious, watchErrors } from './fixtures';

test.describe('dealer portal', () => {
  test('landing shows no invented prices; signup validates; new account lands on a pending dashboard that cannot submit', async ({ page, request }) => {
    const errors = watchErrors(page, /favicon|Failed to load resource.*(40[134])/i);
    await page.goto('/dealers', { waitUntil: 'networkidle' });
    await expect(page.locator('h1')).toHaveCount(1);
    expect(await page.locator('main').innerText()).not.toMatch(/\$\s?\d/);
    expect(await axeSerious(page)).toEqual([]);

    await page.goto('/dealers/signup', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Create dealer account' }).click();
    await expect(page.locator('#businessName-err')).toBeVisible();
    const stamp = Date.now().toString(36);
    await page.getByLabel('Business name').fill(`E2E Motors ${stamp}`);
    await page.getByLabel('Your name').fill('Pat Manager');
    await page.getByLabel('Phone').fill('916 555 0123');
    await page.getByLabel('Your email').fill(`pat-${stamp}@e2e.example`);
    await page.locator('#lot0').fill('1 Auto Mall Dr, Roseville, CA 95661');
    await page.getByLabel('Accounts payable email').fill(`ap-${stamp}@e2e.example`);
    await page.getByLabel(/Expected vehicles per month/).fill('40');
    expect(await axeSerious(page)).toEqual([]);
    await page.getByRole('button', { name: 'Create dealer account' }).click();
    await page.waitForURL('**/dealers/dashboard');
    await expect(page.locator('#main').getByText('Your account is waiting for approval')).toBeVisible();
    expect(await axeSerious(page)).toEqual([]);
    await page.goto('/dealers/dashboard/submit');
    await expect(page.locator('#main').getByText(/Submitting opens when your account is approved/)).toBeVisible();
    const blocked = await page.request.post('/api/dealers/vehicles', { data: { csv: 'vin\n1HGCM82633A004352' }, headers: { Origin: new URL(page.url()).origin } });
    expect(blocked.status()).toBe(403);
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
    // not signed in: the API refuses
    expect([401, 403]).toContain((await request.post('/api/dealers/vehicles', { data: { csv: 'vin\nx' } })).status());
    expect(errors).toEqual([]);
  });
});
