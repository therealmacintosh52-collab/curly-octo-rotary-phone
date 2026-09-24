/**
 * Hero at 0 / 50 / 100% of the scroll story, desktop and mobile, plus a
 * record of the JavaScript each page actually requests.
 *
 * Note for anyone reading the output: this machine has no GPU. WebGL runs on
 * SwiftShader, in software. The frames are real renders of the real scene,
 * but timings taken here are worse than any real device would produce, and
 * `detect-gpu` would refuse the scene entirely — hence `?scene=force`.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:4321";
const OUT = new URL("../shots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, mobile: false },
  { name: "mobile", width: 390, height: 844, mobile: true },
];

/* CHROME_PATH lets this run against a browser the environment already has,
   instead of downloading another copy. */
const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
);

/* --- 1. what does a page actually download? --------------------------- */
for (const [label, url] of [
  ["normal visit (software GPU → poster only)", `${BASE}/`],
  ["scene forced on", `${BASE}/?scene=force`],
]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const js = [];
  page.on("response", (r) => {
    if (/\.js(\?|$)/.test(r.url())) js.push([r.url().split("/").pop(), Number(r.headers()["content-length"] ?? 0)]);
  });
  const logs = [];
  page.on("console", (m) => m.text().startsWith("[hero]") && logs.push(m.text()));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  console.log(`\n${label}`);
  console.log("  console:", logs.join(" | ") || "(none)");
  console.log(`  JS requested: ${js.length} file(s)`);
  for (const [name] of js) console.log("    ", name);
  await page.close();
}

/* --- 2. the screenshots ------------------------------------------------ */
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.mobile ? 2 : 1,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  });
  await page.goto(`${BASE}/?scene=force`, { waitUntil: "networkidle" });
  // Let the environment map build and the first frames settle.
  await page.waitForFunction(() => document.querySelector("#hero-canvas canvas") !== null, null, { timeout: 30000 });
  await page.waitForTimeout(3000);

  for (const pct of [0, 50, 100]) {
    await page.evaluate((p) => {
      const stage = document.querySelector("[data-scene-range]");
      const top = stage.getBoundingClientRect().top + scrollY;
      const span = stage.offsetHeight - innerHeight;
      scrollTo({ top: top + (span * p) / 100, behavior: "instant" });
    }, pct);
    // Wait for the shader's eased progress to actually reach the target
    // rather than sleeping and hoping — on a software renderer the move can
    // take many seconds to settle.
    await page
      .waitForFunction(
        (want) => {
          const v = parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue("--scene-eased")
          );
          return Number.isFinite(v) && Math.abs(v - want) < 0.02;
        },
        pct / 100,
        { timeout: 45000 }
      )
      .catch(() => console.log(`  (warning: ${pct}% never settled; frame may be mid-move)`));
    await page.waitForTimeout(400);
    const file = `${OUT}hero-${vp.name}-${String(pct).padStart(3, "0")}.png`;
    await page.screenshot({ path: file });
    const progress = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--scene-progress").trim()
    );
    console.log(`  ${vp.name} @ ${pct}%  scene-progress=${progress || "(unset)"}  → ${file.split("/").pop()}`);
  }
  await page.close();
}

await browser.close();
