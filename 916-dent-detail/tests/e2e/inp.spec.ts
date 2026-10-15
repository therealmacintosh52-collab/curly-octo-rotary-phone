// INP lab proxy: scripted interactions measured with the Event Timing API (the data web-vitals reads) under a 4x CPU slowdown on the
// mobile project (Lighthouse's own mobile convention). It is a LAB PROXY on software-rendered headless Chromium: real INP needs field data.
// Each page's trace is run 3 times and the MEDIAN of the per-run worst interaction is compared with the 200 ms "good" threshold, so one noisy
// run cannot fail (or hide a regression in) the suite. The numbers are printed and attached to the report.
import { test, expect } from './fixtures';

type Entry = { interactionId: number; duration: number };
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;

test('INP lab proxy: median worst interaction per page is within 200 ms', async ({ page, browserName }, info) => {
  test.setTimeout(300_000); // 4 pages x 3 runs under CPU throttling
  test.skip(browserName !== 'chromium', 'Event Timing + CDP throttling are Chromium only');
  const cdp = await page.context().newCDPSession(page);
  const rate = info.project.name === 'mobile' ? 4 : 1;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  // every run starts from a blank booking draft (otherwise run 2 of /book restores run 1's draft and starts on step 2)
  await page.addInitScript(() => { try { localStorage.removeItem('d916_booking_draft_v1'); sessionStorage.removeItem('d916_booking_hold_v1'); } catch { /* storage blocked */ } });
  await page.addInitScript(() => {
    const w = window as unknown as { __ev: Entry[] };
    w.__ev = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as (PerformanceEntry & { interactionId: number })[]) if (e.interactionId) w.__ev.push({ interactionId: e.interactionId, duration: e.duration });
    }).observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit);
  });

  const traces: [string, () => Promise<void>][] = [
    ['/', async () => {
      await page.mouse.wheel(0, 900); await page.waitForTimeout(500); await page.mouse.wheel(0, -900); await page.waitForTimeout(300);
      await page.getByRole('button', { name: 'Chat with the 916 Concierge' }).click(); await page.getByRole('dialog').waitFor(); await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
    }],
    ['/book', async () => {
      await page.getByLabel(/Dent Removal/).check(); await page.getByLabel(/Paint Deep-Clean/).check();
      await page.getByRole('button', { name: 'Continue' }).click(); await page.waitForTimeout(400);
      await page.getByLabel('Year', { exact: true }).fill('2020'); await page.getByLabel(/Sedan/).check();
    }],
    ['/dealers', async () => {
      await page.mouse.wheel(0, 1500); await page.waitForTimeout(400);
      const q = page.locator('main button[aria-expanded]').first(); if (await q.count()) { await q.click(); await page.waitForTimeout(200); }
    }],
    ['/services/paintless-dent-repair', async () => {
      await page.mouse.wheel(0, 1500); await page.waitForTimeout(400);
      const q = page.locator('main button[aria-expanded]').first(); if (await q.count()) { await q.click(); await page.waitForTimeout(200); }
    }],
  ];

  const results: { page: string; median: number; runs: number[]; interactions: number }[] = [];
  for (const [path, steps] of traces) {
    const runs: number[] = []; let n = 0;
    for (let i = 0; i < 3; i++) {
      await page.goto(path, { waitUntil: 'load' });
      await page.waitForTimeout(1500); // let hydration finish before the first scripted interaction
      await page.evaluate(() => { (window as unknown as { __ev: Entry[] }).__ev = []; });
      await steps();
      await page.waitForTimeout(400);
      const ev = await page.evaluate(() => (window as unknown as { __ev: Entry[] }).__ev);
      const byId = new Map<number, number>();
      for (const e of ev) byId.set(e.interactionId, Math.max(byId.get(e.interactionId) ?? 0, e.duration));
      runs.push(Math.round(Math.max(0, ...byId.values()))); n = Math.max(n, byId.size);
    }
    results.push({ page: path, median: median(runs), runs, interactions: n });
  }
  const worst = Math.max(...results.map((r) => r.median));
  info.annotations.push({ type: 'INP lab proxy', description: `${info.project.name} (${rate}x CPU): ${results.map((r) => `${r.page}=${r.median}ms [${r.runs.join('/')}]`).join(', ')}; worst median ${worst}ms` });
  console.log(`INP-proxy ${info.project.name} cpu=${rate}x: ${JSON.stringify(results)} worst-median=${worst}ms`);
  expect(results.filter((r) => r.interactions > 0).length, 'the traces recorded real interactions on at least three pages').toBeGreaterThanOrEqual(3);
  expect(worst).toBeLessThanOrEqual(200);
});
