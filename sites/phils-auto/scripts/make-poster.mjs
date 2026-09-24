/**
 * The hero poster, rendered from the hero.
 *
 * Not a mock-up of the scene and not a hand-made stand-in: the scene is run
 * headlessly at its opening frame and the canvas is read straight out as
 * WebP. So the still a low-tier phone sees is the same image the scene would
 * have drawn for it.
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:4321";
const OUT = new URL("../public/img/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
);
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(`${BASE}/?scene=force`, { waitUntil: "networkidle" });
await page.waitForFunction(() => document.querySelector("#hero-canvas canvas") !== null, null, {
  timeout: 30000,
});
// Let the environment map build and the idle rotation reach a good angle.
await page.waitForTimeout(4000);

const dataUrl = await page.evaluate(async () => {
  const canvas = document.querySelector("#hero-canvas canvas");
  // Force one more render so the buffer is guaranteed fresh before the read.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return canvas.toDataURL("image/webp", 0.82);
});

if (!dataUrl.startsWith("data:image/webp")) {
  console.error("The browser would not encode WebP; poster not written.");
  process.exit(1);
}

const buf = Buffer.from(dataUrl.split(",")[1], "base64");
writeFileSync(OUT + "hero-poster.webp", buf);
console.log(`hero-poster.webp — ${(buf.length / 1024).toFixed(1)} KB, 1600x900, from the live scene`);

await browser.close();
