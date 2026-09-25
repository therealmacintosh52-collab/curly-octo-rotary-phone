/**
 * Core Web Vitals, measured straight from the browser.
 *
 * Lighthouse cannot complete against this page in this container: a looping
 * background video never lets the page reach network-quiet, and Lighthouse's
 * own outbound calls are blocked by the egress policy here, so each run sits
 * until it is killed. The metrics themselves are still perfectly measurable —
 * PerformanceObserver reports the same LCP and CLS Lighthouse would read.
 *
 * Throttling is applied over CDP so the numbers mean something: slow 4G and a
 * 4x CPU slowdown, matching Lighthouse's mobile preset.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://127.0.0.1:4321";
const paths = process.argv.slice(2);
if (!paths.length) paths.push("/");

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
);

console.log("path".padEnd(22), "LCP".padStart(9), "CLS".padStart(8), "longtasks".padStart(11), "transferred".padStart(13));
console.log("-".repeat(68));

for (const path of paths) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 823 },
    deviceScaleFactor: 1.75,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1638.4 * 1024) / 8,
    uploadThroughput: (675 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  let bytes = 0;
  page.on("response", async (r) => {
    const len = Number(r.headers()["content-length"] ?? 0);
    if (Number.isFinite(len)) bytes += len;
  });

  await page.addInitScript(() => {
    window.__v = { lcp: 0, cls: 0, long: 0 };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__v.lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__v.cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => {
      window.__v.long += l.getEntries().length;
    }).observe({ type: "longtask", buffered: true });
  });

  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  // Settle LCP: it is only final once the user interacts or the page hides.
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  const v = await page.evaluate(() => window.__v);

  console.log(
    path.padEnd(22),
    `${(v.lcp / 1000).toFixed(2)}s`.padStart(9),
    v.cls.toFixed(3).padStart(8),
    String(v.long).padStart(11),
    `${(bytes / 1024).toFixed(0)} KB`.padStart(13)
  );
  await context.close();
}

console.log("\nslow-4G + 4x CPU throttle, 412x823 mobile.");
await browser.close();
