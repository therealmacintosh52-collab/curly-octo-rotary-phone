// INP lab proxy: scripted interactions (nav, CTA, booking inputs/toggles, chat open) measured with the Event Timing API
// (the same data web-vitals uses), 4x CPU throttle on the mobile project to approximate a mid-range phone. Real INP needs field data.
import { test, expect } from './fixtures';

type Entry = { name: string; duration: number; interactionId: number; target: string };

test('INP lab proxy under 200 ms across a scripted session', async ({ page, browserName }, info) => {
  test.skip(browserName !== 'chromium', 'Event Timing via CDP throttle is Chromium only');
  const cdp = await page.context().newCDPSession(page);
  const rate = info.project.name === 'mobile' ? 4 : 1;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await page.addInitScript(() => {
    const w = window as unknown as { __ev: Entry[] };
    w.__ev = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as (PerformanceEntry & { interactionId: number; target?: Element })[]) {
        if (e.interactionId) w.__ev.push({ name: e.name, duration: e.duration, interactionId: e.interactionId, target: (e.target as Element | undefined)?.tagName ?? '' });
      }
    }).observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit);
  });
  // Each navigation resets the observer buffer, so every page below is measured on its own and the worst interaction wins.
  const results: { page: string; inp: number; n: number }[] = [];
  for (const [path, steps] of [
    ['/', async () => { await page.mouse.wheel(0, 900); await page.waitForTimeout(300); await page.mouse.wheel(0, -900); await page.waitForTimeout(300); await page.getByRole('button', { name: 'Chat with the 916 Concierge' }).click(); await page.getByRole('dialog').waitFor(); await page.waitForTimeout(300); await page.keyboard.press('Escape'); }],
    ['/book', async () => { await page.getByLabel(/Dent Removal/).check(); await page.getByLabel(/Paint Deep-Clean/).check(); await page.getByRole('button', { name: 'Continue' }).click(); await page.waitForTimeout(300); await page.getByLabel('Year', { exact: true }).fill('2020'); await page.getByLabel(/Sedan/).check(); }],
    ['/dealers', async () => { await page.mouse.wheel(0, 1200); await page.waitForTimeout(300); await page.getByRole('link', { name: /signup|account|Create/i }).first().focus(); }],
    ['/services/paintless-dent-repair', async () => { await page.mouse.wheel(0, 1500); await page.waitForTimeout(300); const f = page.locator('details summary').first(); if (await f.count()) await f.click(); }],
  ] as [string, () => Promise<void>][]) {
    await page.goto(path, { waitUntil: 'networkidle' });
    await page.evaluate(() => { (window as unknown as { __ev: Entry[] }).__ev = []; });
    await steps();
    await page.waitForTimeout(500);
    const ev = await page.evaluate(() => (window as unknown as { __ev: Entry[] }).__ev);
    // INP = the longest interaction (for < 50 interactions), interaction = max duration of its events
    const byId = new Map<number, number>();
    for (const e of ev) byId.set(e.interactionId, Math.max(byId.get(e.interactionId) ?? 0, e.duration));
    const worst = Math.max(0, ...byId.values());
    results.push({ page: path, inp: Math.round(worst), n: byId.size });
  }
  const worstAll = Math.max(...results.map((r) => r.inp));
  info.annotations.push({ type: 'INP lab proxy', description: `${info.project.name} (${rate}x CPU): ${results.map((r) => `${r.page}=${r.inp}ms/${r.n}`).join(', ')}; worst ${worstAll}ms` });
  console.log(`INP-proxy ${info.project.name} cpu=${rate}x: ${JSON.stringify(results)} worst=${worstAll}ms`);
  expect(results.some((r) => r.n > 0), 'the trace recorded at least one interaction').toBe(true);
  expect(worstAll).toBeLessThanOrEqual(200);
});
