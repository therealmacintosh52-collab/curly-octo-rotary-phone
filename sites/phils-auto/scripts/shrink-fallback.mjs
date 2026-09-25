/**
 * Re-encode the hero fallback photograph as WebP.
 *
 * It is a 400 KB JPEG that only the fallback path ever fetches, but on that
 * path it is the largest thing on the page. There is no image library here,
 * so the browser does the encoding.
 */
import { chromium } from "playwright";
import { writeFileSync, statSync } from "node:fs";

const SRC = process.argv[2] ?? "public/media/03-engine.jpg";
const OUT = process.argv[3] ?? "public/media/03-engine.webp";
const MAX_W = 1280;

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
);
const page = await browser.newPage();
await page.goto("http://127.0.0.1:4321/");

const dataUrl = await page.evaluate(async ({ src, maxW }) => {
  const img = await new Promise((r, j) => {
    const i = new Image();
    i.onload = () => r(i);
    i.onerror = j;
    i.src = src;
  });
  const scale = Math.min(1, maxW / img.naturalWidth);
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  const x = c.getContext("2d");
  x.imageSmoothingQuality = "high";
  x.drawImage(img, 0, 0, c.width, c.height);
  return { url: c.toDataURL("image/webp", 0.72), w: c.width, h: c.height };
}, { src: "/media/" + SRC.split("/").pop(), maxW: MAX_W });

const buf = Buffer.from(dataUrl.url.split(",")[1], "base64");
writeFileSync(OUT, buf);
console.log(
  `${OUT}  ${dataUrl.w}x${dataUrl.h}  ${(buf.length / 1024).toFixed(0)} KB ` +
  `(was ${(statSync(SRC).size / 1024).toFixed(0)} KB)`
);
await browser.close();
