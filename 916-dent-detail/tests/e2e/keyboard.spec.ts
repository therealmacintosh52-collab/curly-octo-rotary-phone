// Keyboard-only pass over the site navigation (the booking flow's keyboard pass lives in booking.spec.ts).
import { test, expect } from './fixtures';

test.describe('keyboard: site navigation', () => {
  test('skip link is first, then logo; desktop nav links are reachable in order and Enter follows them; focus is always visible', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop nav is hidden below 1024px (see the mobile menu test)');
    await page.goto('/pricing', { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /skip to content/i })).toBeFocused();
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => { const el = document.activeElement as HTMLElement | null; const cs = el ? getComputedStyle(el) : null; return { name: (el?.textContent ?? '').trim().slice(0, 30), nav: el?.closest('nav')?.getAttribute('aria-label') ?? '', ring: !!cs && ((cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none') }; });
      if (info.nav === 'Main') { seen.push(info.name); expect(info.ring, `focus ring on "${info.name}"`).toBe(true); if (info.name === 'Book') break; }
    }
    expect(seen).toEqual(['Services', 'Dealers', 'Pricing', 'Reviews', 'Book']);
    // Enter follows the focused link (Book is focused now)
    await page.keyboard.press('Enter');
    await page.waitForURL('**/book');
  });

  test('mobile menu: button opens with Enter, links are tabbable, Escape closes and returns focus to the button', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile menu only exists below 1024px');
    await page.goto('/pricing', { waitUntil: 'networkidle' });
    const btn = page.getByRole('button', { name: 'Open menu' });
    await btn.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#mobile-nav')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Tab');
    await expect(page.locator('#mobile-nav a').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-nav')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused();
    // and a link activates with Enter
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => u.pathname !== '/pricing');
  });

  test('chat dialog: Tab stays inside, Escape closes and focus returns to the launcher', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Chat with the 916 Concierge' }).focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: '916 Concierge' });
    await dialog.waitFor();
    for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.activeElement?.hasAttribute('data-concierge-launcher'))).toBe(true);
  });
});
