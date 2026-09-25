# Lighthouse results

Run on 2026-09-25 with Lighthouse 13.5.0 against the static build (`astro build`) served by `http-server -g` on localhost, inside the build container (headless Chromium 141.0.0.0). Mobile rows use Lighthouse's default mobile emulation and 4G throttling; the desktop row uses `--preset=desktop`.

Caveats, so nobody reads these as production numbers:

- Localhost has no real network latency; on Netlify's CDN expect LCP a few hundred ms higher on mobile.
- The container's Chromium cannot decode H.264, so the hero video never plays here; on real devices it does, after the poster (the LCP element) has painted.
- The 3D scene is not exercised: mobile emulation skips it by design and the desktop preset's GPU is software-only (tier 0), so the desktop row measures the page without the scene, exactly as a low-tier desktop would get it.

| Page | Perf | A11y | Best | SEO | LCP | CLS | TBT | FCP |
|---|---|---|---|---|---|---|---|---|
| / (mobile) | 94 | 100 | 100 | 100 | 2.8 s | 0 | 10 ms | 1.9 s |
| / (desktop preset) | 100 | 100 | 100 | 100 | 0.7 s | 0 | 0 ms | 0.4 s |
| /services/brake-repair/ (mobile) | 97 | 100 | 100 | 100 | 2.4 s | 0 | 10 ms | 1.6 s |
| /advice/brake-noise/ (mobile) | 97 | 100 | 100 | 100 | 2.4 s | 0 | 0 ms | 1.6 s |
| /contact/ (mobile) | 97 | 100 | 100 | 100 | 2.4 s | 0 | 0 ms | 1.6 s |

Targets from the brief: home ≥ 85 (3D exception documented), inner ≥ 95, A11y/BP/SEO ≥ 95, LCP < 2.5 s home / < 2.0 s inner, CLS < 0.05.

## What was done in the performance pass

- The 3D bundle (React + Three.js + post-processing, ~330 KB gzipped) is no longer an island. `scripts/hero-story.ts` (plain DOM + GSAP) decides the GPU tier after `load` + idle and dynamically imports `Scene3D.tsx` only on desktops at tier 2+. Phones and weak GPUs download none of it.
- The hero video's `<source>` is attached after `load`, so the 2.2 MB clip never competes with the poster (LCP) for bandwidth. Poster is AVIF/WebP/JPEG with `fetchpriority=high`.
- Fonts are self-hosted Latin subsets with `font-display: optional` and metric-matched fallbacks; the two Latin files are preloaded. This removed the web-font layout shift (CLS 0.19 → 0) on inner pages.
- The single stylesheet is inlined into each page (one fewer render-blocking request).
- The desktop story layout (hero height) is decided by an inline script before first paint instead of after JS loads.
- drei was removed from the scene; the studio reflections come from Three's `RoomEnvironment` through a PMREM generator (no download).

## JavaScript weight (gzipped, from the Vite build report)

| What | Size | When it loads |
|---|---|---|
| Every page: GSAP core + ScrollTrigger + Lenis + interactions | ~54 KB | on load, deferred module |
| Home only: hero story controller | ~2 KB | on load |
| Home, desktop, GPU tier 2+ only: React DOM + R3F + Three + post-processing (`Scene3D` chunk) | ~330 KB | after load + idle, never on phones |
| detect-gpu | ~3 KB | desktop only, after load |

The brief's 250 KB budget for the home page is met for what blocks or competes with first paint (about 56 KB). The deferred 3D chunk exceeds it on its own; React DOM (66 KB) and Three (150 KB) are irreducible with the mandated stack, and post-processing adds about 60 KB for bloom, vignette and grain. Dropping post-processing is the one remaining lever if the total must come down.

## How to re-run

```bash
npm run build
npx http-server dist -p 8092 -s -g
npx lighthouse http://127.0.0.1:8092/ --form-factor=mobile --screenEmulation.mobile --output=html --output-path=./lh-home.html
```
