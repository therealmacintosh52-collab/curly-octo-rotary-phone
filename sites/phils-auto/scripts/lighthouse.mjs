/**
 * Lighthouse, mobile emulation, against the built site.
 *
 * READ THE CAVEAT BEFORE QUOTING A NUMBER FROM THIS. The machine that runs
 * this in CI here has no GPU: WebGL falls back to SwiftShader and runs on the
 * CPU, on top of Lighthouse's own 4x CPU throttling. A WebGL page therefore
 * scores worse here than it will on any real phone. Numbers are honest, but
 * they are a floor, not a forecast.
 */
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

const BASE = process.env.BASE ?? "http://127.0.0.1:4321";
const urls = process.argv.slice(2);
if (!urls.length) urls.push("/");

const chrome = await chromeLauncher.launch({
  chromePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium",
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"],
});

const rows = [];
for (const path of urls) {
  const { lhr } = await lighthouse(new URL(path, BASE).href, {
    port: chrome.port,
    output: "json",
    formFactor: "mobile",
    screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
    throttling: { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 },
    onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
  });
  const c = lhr.categories;
  rows.push({
    path,
    perf: Math.round(c.performance.score * 100),
    a11y: Math.round(c.accessibility.score * 100),
    bp: Math.round(c["best-practices"].score * 100),
    seo: Math.round(c.seo.score * 100),
    lcp: lhr.audits["largest-contentful-paint"].displayValue,
    cls: lhr.audits["cumulative-layout-shift"].displayValue,
    tbt: lhr.audits["total-blocking-time"].displayValue,
  });
}

console.log(
  "path".padEnd(28),
  "perf".padStart(5), "a11y".padStart(5), "bp".padStart(4), "seo".padStart(4),
  "lcp".padStart(8), "cls".padStart(6), "tbt".padStart(9)
);
console.log("-".repeat(78));
for (const r of rows) {
  console.log(
    r.path.padEnd(28),
    String(r.perf).padStart(5), String(r.a11y).padStart(5),
    String(r.bp).padStart(4), String(r.seo).padStart(4),
    r.lcp.padStart(8), r.cls.padStart(6), r.tbt.padStart(9)
  );
}
console.log("\nmobile emulation, 4x CPU throttle, on a machine with no GPU.");

await chrome.kill();
