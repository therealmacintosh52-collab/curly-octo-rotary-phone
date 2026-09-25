/**
 * Checks the video hero against the spec, in a real browser.
 *
 * This machine's Chromium has no H.264 decoder, so hero.mp4 cannot play here
 * — which is useful: it exercises the fallback path for free. To see the
 * layout with a video actually running, the run with `--playing` swaps in a
 * WebM this browser can decode. Same code path, different codec.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://127.0.0.1:4321";
const SUB = process.env.WEBM; // optional decodable stand-in

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
);

async function run(label, { substitute = false, reducedMotion = null, saveData = false } = {}) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: reducedMotion ?? undefined,
  });
  if (saveData) {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "connection", { get: () => ({ saveData: true }) })
    );
  }
  if (substitute && SUB) {
    await page.route("**/media/hero.mp4", (r) => r.fulfill({ status: 302, headers: { location: SUB } }));
  }

  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);

  const r = await page.evaluate(() => {
    const hero = document.querySelector("[data-hero]");
    const v = document.getElementById("hero-video");
    const scrim = document.querySelector(".nav-scrim");
    const header = document.querySelector(".site-header");
    const inner = document.querySelector(".hero-inner");
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const hv = cs(v), hh = cs(header), hi = cs(inner);
    return {
      heroFillsViewport:
        Math.abs(hero.getBoundingClientRect().height - innerHeight) < 2 &&
        Math.abs(hero.getBoundingClientRect().width - innerWidth) < 2,
      videoAttrs: v
        ? {
            muted: v.muted,
            loop: v.loop,
            autoplay: v.autoplay,
            controls: v.controls,
            playsinline: v.hasAttribute("playsinline"),
            objectFit: hv.objectFit,
            paused: v.paused,
            readyState: v.readyState,
            errCode: v.error?.code ?? null,
          }
        : "video removed (fallback)",
      videoBehindContent: v ? Number(cs(v.parentElement).zIndex) < Number(hi.zIndex) : null,
      headerBgAtTop: hh.backgroundColor,
      navScrim: scrim ? cs(scrim).backgroundImage.slice(0, 64) : "missing",
      copyVisible: hi ? +hi.opacity : null,
      state: hero.className,
    };
  });

  // Capture the hero itself before scrolling anywhere.
  await page.screenshot({ path: `shots/hero-video-${label.replace(/\W+/g, "-")}.png` });

  // Scroll past the hero and re-read the header.
  await page.evaluate(() => scrollTo({ top: innerHeight * 1.4, behavior: "instant" }));
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => {
    const header = document.querySelector(".site-header");
    const page_ = document.querySelector(".page");
    return {
      headerBgPastHero: getComputedStyle(header).backgroundColor,
      contentBg: getComputedStyle(page_).backgroundColor,
      contentOpaque: getComputedStyle(page_).backgroundColor.startsWith("rgb("),
    };
  });

  console.log(`\n── ${label}`);
  console.log(JSON.stringify({ ...r, ...after }, null, 1));
  await page.screenshot({ path: `shots/hero-video-${label.replace(/\W+/g, "-")}-scrolled.png` });
  await page.close();
}

await run("as-shipped (no H264 here, so fallback)");
if (SUB) await run("playing", { substitute: true });
await run("reduced motion", { reducedMotion: "reduce" });
await run("save-data", { saveData: true });

await browser.close();
