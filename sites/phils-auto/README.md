# Phil's Auto and Fleet Repair — site

Astro 7 + React 19 islands. Static output, no server.

## Assumptions

Filled in from material already in this repo rather than spending the brief's
three questions on them. Correct any line and I will rebuild against it.

- **Primary CTA is the phone**, not the form. A broken car is a phone call.
- **Stack is Astro, not Next.** Zero JS by default makes the inner-page budget
  the framework's behaviour instead of something to fight it for.
- **No GLB.** The hero engine is built from primitives in code, so there is no
  model to download and every part keeps its own material for the
  desaturation pass.
- **Every fact is sourced.** Phone, "tires at our cost", Interstate Batteries,
  Mastercraft, ASC membership — all read off photographs of the building.
  Rating and hours from the Google Business Profile. Reviews quoted verbatim.
  Nothing about certifications, warranties or years in business is claimed,
  because nothing supports it yet.
- **Competitors and reference sites were not reviewed.** Outbound network here
  reaches GitHub and npm only.

## Run

```bash
npm install
npm run dev          # localhost:4321
npm run build        # → dist/
npm run preview      # serve dist/
```

## Check

```bash
npm run check:budget # JS budget, measured by reachability from the HTML
npm run lh           # Lighthouse, mobile emulation, against the preview
node scripts/vitals.mjs       # LCP and CLS straight from PerformanceObserver
node scripts/check-hero.mjs   # the hero's four paths, screenshotted
node scripts/contrast.mjs     # WCAG ratios for the palette
```

`CHROME_PATH=/path/to/chrome` makes the browser scripts use a browser the
machine already has instead of downloading one. `WEBM=/media/x.webm` makes
`check-hero.mjs` substitute a decodable clip, which matters on any machine
without an H.264 decoder — headless Chromium here has none.

Lighthouse takes **several minutes** against this page: a looping background
video never lets it reach network-quiet. Give it room rather than assuming it
has hung, and kill stray `chrome` processes between runs — orphans from an
interrupted run will quietly skew everything after them.

## The hero

A full-bleed background video, `src/components/VideoHero.astro`.

The interesting part is not the video, it is everything that happens when it
does not play. Autoplay is refused in iOS Low Power Mode; a Save-Data or
reduced-motion visitor should not be served a looping megabyte and a half;
a codec can simply fail. Each of those falls back to a still photograph, and
the hero copy — which by design waits for the video — is released by whichever
comes first, the `playing` event or a four-second backstop. The page is never
left wordless. `scripts/check-hero.mjs` walks all four paths and screenshots
each one.

Two things worth knowing before changing it:

- **`preload` decides your LCP.** `preload="auto"` tries to buffer the whole
  file before playing, which pushed first paint to 13.7s on throttled 4G.
  `preload="metadata"` streams it: 1.5s. Do not "optimise" this back.
- **The fallback image ships as `data-src`, not `src`.** As a plain `<img>` it
  is a full-viewport photograph that every visitor downloads and that wins the
  LCP race against the copy, for a picture most of them never see.

The current clip is **368 × 816** — fine on a phone (1.1× upscale), poor on a
desktop, where `object-fit: cover` has to enlarge it ~5× and crops away three
quarters of the frame. Replacing it with a 1920 × 1080 landscape clip is the
fix; nothing in the component needs to change.

## Measured, not claimed

Mobile emulation, 4× CPU throttling, five runs on the home page:

| | Result |
| --- | --- |
| Accessibility · Best practices · SEO | **100 / 100 / 100** — identical in every run |
| Performance | **89–100**, median 98 |
| LCP | **1.3 – 2.4s** (target < 2.5s) |
| CLS | **0** in every run |
| TBT | 0 – 460ms |

The performance spread is this container, not the page: it is shared and
throttled, and video decode here is software. A single run is not a number —
the 89 and the 100 are the same build. Quote the range.

`scripts/vitals.mjs` measures LCP and CLS independently through
PerformanceObserver and agreed with Lighthouse to within 10ms, which is the
main reason to trust either.

JS budget, measured by following what the HTML actually pulls: **1.6 KB
critical**, 5.3 KB deferred. There is no React and no Three.js in the project
— the WebGL hero that needed them is in history at `04b6db3`.
