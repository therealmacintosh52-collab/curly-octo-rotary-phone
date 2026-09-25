import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
const chrome = await chromeLauncher.launch({ chromePath: "/opt/pw-browsers/chromium",
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"] });
const { lhr } = await lighthouse("http://127.0.0.1:4321/", { port: chrome.port, output: "json",
  formFactor: "mobile", screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
  throttling: { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 },
  maxWaitForLoad: 25000,
  onlyCategories: ["performance", "accessibility", "best-practices", "seo"] });
const c = lhr.categories;
console.log("SCORES", JSON.stringify(Object.fromEntries(
  Object.entries(c).map(([k, v]) => [k, Math.round(v.score * 100)]))));
console.log("LCP", lhr.audits["largest-contentful-paint"].displayValue,
            "CLS", lhr.audits["cumulative-layout-shift"].displayValue,
            "TBT", lhr.audits["total-blocking-time"].displayValue);
for (const [key, cat] of Object.entries(c)) {
  const bad = cat.auditRefs.map(r => lhr.audits[r.id]).filter(a => a.score !== null && a.score < 1);
  if (!bad.length) continue;
  console.log(`\n${key}:`);
  for (const a of bad.slice(0, 6)) {
    console.log(`  - ${a.id}: ${a.title} ${a.displayValue ?? ""}`);
    for (const it of (a.details?.items ?? []).slice(0, 3))
      console.log("      ", (it.node?.snippet ?? it.url ?? "").slice(0, 110));
  }
}
await chrome.kill();
