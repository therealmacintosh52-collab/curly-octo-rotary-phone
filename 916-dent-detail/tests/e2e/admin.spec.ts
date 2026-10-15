// Admin smoke (demo login in the mock production build): auth gates, login -> home -> Today (tech view), core screens render, inbox.
import { test, expect, axeSerious, watchErrors } from './fixtures';

test.describe('admin', () => {
  test('anonymous requests are refused; /admin redirects to login and is noindex', async ({ page, request }) => {
    expect((await request.get('/api/admin/customers')).status()).toBe(401);
    expect((await request.get('/api/admin/photo?path=jobs/x')).status()).toBe(401);
    await page.goto('/admin');
    expect(page.url()).toContain('/admin/login');
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
    expect((await request.get('/admin/login')).headers()['x-robots-tag'] ?? '').toMatch(/noindex/);
    expect(await axeSerious(page)).toEqual([]);
  });

  test('owner demo login -> home -> today view; main screens load without errors and pass axe', async ({ page }) => {
    const errors = watchErrors(page, /favicon|Failed to load resource/i);
    await page.goto('/admin/login');
    await page.getByRole('button', { name: /DEMO Owner/ }).click();
    await page.waitForURL((u) => !u.pathname.endsWith('/login'));
    await expect(page.getByText(/DEMO MODE/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Quick add lead' })).toBeVisible();
    expect(await axeSerious(page)).toEqual([]);

    await page.goto('/admin/today', { waitUntil: 'load' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await axeSerious(page)).toEqual([]);

    for (const path of ['/admin/pipeline', '/admin/schedule', '/admin/customers', '/admin/reports', '/admin/invoices', '/admin/inbox', '/admin/more', '/admin/dealers']) {
      const res = await page.goto(path, { waitUntil: 'load' });
      expect(res?.status(), path).toBeLessThan(400);
      await expect(page.getByRole('heading', { level: 1 }).first(), path).toBeVisible();
      expect(await axeSerious(page), path).toEqual([]);
    }
    expect(errors).toEqual([]);
  });

  test('tech role is limited to the tech screens', async ({ page }) => {
    await page.goto('/admin/login');
    const tech = page.getByRole('button', { name: /DEMO Tech One/ });
    await tech.click();
    await page.waitForURL((u) => !u.pathname.endsWith('/login'));
    expect(page.url()).toContain('/admin/today');
    await page.goto('/admin/reports');
    expect(page.url()).not.toContain('/admin/reports'); // bounced to the tech home
    await page.goto('/admin/inbox');
    expect(page.url()).not.toContain('/admin/inbox');
  });
});
