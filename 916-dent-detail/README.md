# 916 Dent & Detail

Mobile paintless dent repair + detailing site for Sacramento. Next.js 16 (App Router, TypeScript strict),
Tailwind v4, GSAP + ScrollTrigger + Lenis. Owner spec: [`SPEC.md`](SPEC.md). Assumptions: [`DECISIONS.md`](DECISIONS.md).
Open items: [`TODO.md`](TODO.md).

**Status:** Phase 1 (scroll-scrub hero + marketing site) built locally. Not deployed. Nothing is live.

## Run it

Requires Node 20.9+ (built on Node 22). No API keys needed for Phase 1.

```bash
npm install
npm run dev            # http://localhost:3000 (dev mode, slower, no perf numbers)
npm run build && npm start   # production build on :3000 (use this for Lighthouse)
```

Optional: `cp .env.example .env.local` and set `NEXT_PUBLIC_SITE_URL` once the domain exists.
Opt out of Next.js telemetry with `npx next telemetry disable` or `NEXT_TELEMETRY_DISABLED=1`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server on :3000 |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint (next core-web-vitals + typescript) |
| `npm run verify` | typecheck + lint + build |
| `npm run media` | Regenerate every image/video asset in `public/` from `brand/` (needs `ffmpeg`, `ffprobe`). Steps can run alone: `node scripts/media.mjs logo favicons og video frames beading manifest` |
| `bash scripts/subset-fonts.sh` | Re-create the subset Michroma/Inter woff2 files in `src/fonts/` from the `@fontsource` packages (needs `pip install fonttools brotli`) |
| `npm run check:owner` | Launch gate: lists every `[OWNER]` placeholder left in `src/`; exits 1 while any remain |
| `node scripts/shots.mjs [url] [outDir] [--reduced]` | Playwright screenshots, mobile 390x844 + desktop 1440x900, hero at 0/35/70/100% and every section |
| `node scripts/axe.mjs [url]` | axe-core audit of every route (mobile, desktop, reduced motion); exits 1 on serious/critical |
| `CHROME_PATH=... node scripts/lh.mjs [url] [outDir] [--desktop] [--runs=N]` | Lighthouse (mobile preset by default), prints a score table |

Shots/axe use Playwright 1.56 browsers: set `PLAYWRIGHT_BROWSERS_PATH` if they are not in the default cache.

## Layout

```
brand/                 source assets from the owner (logo.jpg, hero-beading.png, hero-video.mp4)
public/                generated assets (do not hand-edit; run `npm run media`)
  brand/               logo-transparent.png, d-mark*.png/webp
  hero/m, hero/d       121 WebP scrub frames (mobile 720x1280, desktop 720x1000 crop)
  hero/poster-*, static-*   frame 0 (LCP poster) and last frame (reduced-motion state), AVIF + WebP
  beading/             hero-beading in 2 sizes + blurred/darkened backdrop
scripts/               media pipeline, font subsetting, QA scripts
src/app/               routes: / /services /dealers /pricing /reviews /book + 404, layout, fonts, manifest
src/components/        Header, Footer, MobileCtaBar, hero/, sections/, BeforeAfter, SectionMotion
src/config/site.ts     business facts (phone, email, hours, URLs) — [OWNER] placeholders
src/config/pricing.ts  every price (null = [OWNER]); UI never hardcodes a number
src/content/home.ts    copy: services (plain name + real term), steps, cities, FAQs
src/lib/               analytics track(), motion loader (GSAP+Lenis on one ticker), head env script
src/generated/media.ts written by the media pipeline (frame count, paths, inline blur placeholders)
```

## How the hero works

- Inline head script sets `html.scrub` before first paint unless `prefers-reduced-motion`, ≤2 CPU cores,
  ≤2 GB device memory or Save-Data. That decides the track height (350svh vs 100svh) with no layout shift.
- Frame 0 is a real `<img>` (AVIF/WebP, `fetchpriority="high"`). Reduced motion gets the last (beaded) frame via `<picture media>`.
- First 10 frames preload 2.5 s after `load` (or on first scroll). GSAP/ScrollTrigger/Lenis and the remaining
  frames load on the first scroll/touch/key, nearest-to-current first, then coarse-to-fine.
- Copy is server-rendered HTML; scroll reveals beats at 30% and 60%.

## Analytics hooks

`track(event, props)` in `src/lib/analytics.ts` pushes to `window.dataLayer`. Wired now: `call_click`,
`text_click`, `quote_requested`, `booking_started`, `cta_click`. Phase 6 connects GA4 / Meta / Google Ads.
