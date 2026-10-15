// Full /book flow in mock mode: service -> vehicle -> photos -> ZIP (unknown, then in area) -> slot -> contact (+ referral code)
// -> mock deposit -> confirmation -> reschedule and cancel through the signed link. Plus a keyboard-only pass.
import { test, expect, photoFiles, axeSerious, watchErrors } from './fixtures';

// Lenis (smooth scroll) can make Playwright's hit-test flaky on buttons under the fold: click through the DOM there.
const domClick = (loc: import('@playwright/test').Locator) => loc.evaluate((el) => (el as HTMLElement).click());

test.describe('booking flow', () => {
  test('dent + interior, unknown ZIP is held for review, in-area ZIP books, deposit, confirmation, reschedule, cancel', async ({ page }) => {
    const errors = watchErrors(page, /favicon|Failed to load resource.*(400|404)/i);
    await page.goto('/book', { waitUntil: 'networkidle' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload({ waitUntil: 'networkidle' });

    // 1 services
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await page.getByLabel(/Dent Removal/).check();
    await page.getByLabel(/Interior Reset/).check();
    expect(await axeSerious(page)).toEqual([]);
    await page.getByRole('button', { name: 'Continue' }).click();

    // 2 vehicle (validation first)
    await page.getByLabel('Year', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText(/Enter a 4-digit year/)).toBeVisible();
    await page.getByLabel('Year', { exact: true }).fill('2021');
    await page.getByLabel('Make', { exact: true }).fill('Toyota');
    await page.getByLabel('Model', { exact: true }).fill('RAV4');
    await page.getByLabel(/SUV \/ Crossover/).check();
    await page.getByRole('button', { name: 'Continue' }).click();

    // 3 photos: required for dents
    await page.locator('#photo-input').waitFor({ state: 'attached' });
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await page.locator('#photo-input').setInputFiles(await photoFiles(2));
    await expect(page.getByText(/DEMO estimate/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Estimate — final price confirmed on inspection.').first()).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    // 4 area: unknown ZIP cannot continue; a real in-area ZIP can
    await page.getByLabel('ZIP code', { exact: true }).fill('90210');
    await page.getByRole('button', { name: 'Check my area' }).click();
    await expect(page.getByText(/service map|outside/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await page.getByLabel('ZIP code', { exact: true }).fill('95757');
    await page.getByRole('button', { name: 'Check my area' }).click();
    await expect(page.getByText('We come to Elk Grove. No travel fee.')).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    // 5 time (real availability)
    await page.getByRole('group', { name: 'Choose a day' }).waitFor({ timeout: 20_000 });
    const firstTime = page.locator('[aria-labelledby="times-h"] button').first();
    await firstTime.waitFor();
    await firstTime.click();
    await expect(firstTime).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Continue' }).click();

    // 6 contact, SMS consent off by default, referral code check, terms/privacy links beside the consent text
    await page.getByLabel('Full name', { exact: true }).fill('Sam Rivera');
    await page.getByLabel('Mobile number', { exact: true }).fill('(916) 555-0142');
    await page.getByLabel('Email', { exact: true }).fill('sam@example.com');
    await page.getByLabel(/Street address/).fill('123 Main St');
    await expect(page.getByLabel(/Text me about my appointment/)).not.toBeChecked();
    await expect(page.getByRole('link', { name: 'text message terms' })).toHaveAttribute('href', '/terms#sms');
    await page.getByLabel('Referral code (optional)').fill('zzzz 9999');
    await page.getByRole('button', { name: 'Apply code' }).click();
    await expect(page.getByText('We could not find that code.')).toBeVisible();
    await page.getByRole('button', { name: 'Reserve my time' }).click();
    await expect(page.getByText('Fix or clear the referral code to continue.')).toBeVisible();
    await page.getByLabel('Referral code (optional)').fill('');
    await page.getByLabel(/Text me about my appointment/).check();
    expect(await axeSerious(page)).toEqual([]);
    await page.getByRole('button', { name: 'Reserve my time' }).click();

    // 7 mock deposit
    await expect(page.getByText('DEMO MODE: no card is charged')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Sam Rivera'); // Back keeps what you typed
    await page.getByRole('button', { name: 'Reserve my time' }).click();
    await expect(page.getByText('DEMO MODE: no card is charged')).toBeVisible();
    await page.getByRole('button', { name: /Confirm demo deposit/ }).click();

    // 8 confirmation + analytics events
    await expect(page.getByRole('heading', { name: "You're booked" })).toBeVisible({ timeout: 20_000 });
    const manage = await page.getByRole('link', { name: 'Change or cancel' }).getAttribute('href');
    expect(manage).toMatch(/^\/booking\//);
    const events = await page.evaluate(() => ((window as unknown as { dataLayer?: { event: string }[] }).dataLayer ?? []).map((e) => e.event));
    for (const e of ['booking_started', 'quote_requested', 'booking_completed']) expect(events).toContain(e);

    // manage link: reschedule then cancel
    await page.goto(manage!, { waitUntil: 'networkidle' });
    expect(await axeSerious(page)).toEqual([]);
    await page.getByRole('button', { name: 'Reschedule' }).click();
    const group = page.getByRole('group', { name: /Times on/ });
    await group.waitFor({ timeout: 15_000 });
    await group.locator('button').nth(2).click({ force: true });
    await domClick(page.getByRole('button', { name: 'Confirm new time' }));
    await expect(page.getByText(/Rescheduled to/)).toBeVisible();
    await domClick(page.getByRole('button', { name: 'Cancel booking' }));
    await domClick(page.getByRole('button', { name: 'Yes, cancel' }));
    await expect(page.getByText(/Cancelled\./).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('an unrelated, tampered or expired booking link shows a calm error, not a stack trace', async ({ page }) => {
    const res = await page.goto('/booking/not-a-real-token', { waitUntil: 'networkidle' });
    expect(res?.status()).toBeLessThan(500);
    await expect(page.locator('body')).not.toContainText(/TypeError|stack|undefined/i);
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
  });

  test('the skip link (a #fragment navigation) does not throw the visitor back to step 1', async ({ page }) => {
    await page.goto('/book', { waitUntil: 'networkidle' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByLabel(/Paint Deep-Clean/).check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByLabel('Year', { exact: true })).toBeVisible();
    await page.getByLabel('Year', { exact: true }).fill('2019');
    await page.locator('.skip-link').focus();
    await page.keyboard.press('Enter'); // hash navigation fires popstate with state === null
    await page.waitForTimeout(600);
    await expect(page.getByLabel('Year', { exact: true })).toBeVisible(); // still on step 2
    await expect(page.getByLabel('Year', { exact: true })).toHaveValue('2019'); // and nothing typed was lost
  });

  test('keyboard only: services, vehicle step, skip link and nav are reachable and operable', async ({ page }) => {
    await page.goto('/book', { waitUntil: 'networkidle' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload({ waitUntil: 'networkidle' });
    // skip link is the first stop and moves focus to main
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /skip to/i }).first()).toBeFocused();
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => document.activeElement?.id)).toMatch(/main/);
    // Space toggles a service checkbox, Continue is reachable with Tab and activated with Enter
    await page.getByLabel(/Paint Deep-Clean/).focus();
    await page.keyboard.press('Space');
    await expect(page.getByLabel(/Paint Deep-Clean/)).toBeChecked();
    const cont = page.getByRole('button', { name: 'Continue' });
    await expect(cont).toBeEnabled();
    await cont.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Year', { exact: true })).toBeVisible();
    // new step moves focus to its heading (screen reader / keyboard users land at the top)
    await expect(page.locator('h2:focus')).toBeVisible(); // focus lands one frame after the step paints (kept off the click's INP path)
    await page.keyboard.type('');
    await page.getByLabel('Year', { exact: true }).focus();
    await page.keyboard.type('2019');
    await page.keyboard.press('Tab'); await page.keyboard.type('Honda');
    await page.keyboard.press('Tab'); await page.keyboard.type('Civic');
    await page.getByLabel(/Sedan/).focus();
    await page.keyboard.press('Space');
    await expect(page.getByLabel(/Sedan/)).toBeChecked();
    await page.getByRole('button', { name: 'Continue' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#photo-input, [aria-labelledby="ar-h"], h2').first()).toBeVisible();
    // every interactive element on this step shows a visible focus indicator
    const bad = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('main a, main button, main input, main select, main textarea'))) {
        if (el.offsetParent === null || (el as HTMLInputElement).type === 'hidden') continue;
        el.focus();
        const cs = getComputedStyle(el);
        const hasRing = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
        // hidden native checkboxes/file inputs draw their ring on a sibling card; accept :focus-visible on a visually-hidden input
        const visuallyHidden = el.getBoundingClientRect().width <= 2;
        if (!hasRing && !visuallyHidden) out.push(el.outerHTML.slice(0, 80));
      }
      return out;
    });
    expect(bad).toEqual([]);
  });
});
