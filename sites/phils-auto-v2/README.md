# Phil's Auto & Fleet Repair — v2

The second-generation site for Phil's Auto & Fleet Repair, 103 E Elm St, Lodi, CA 95240 ·
(209) 647-4953. Astro 5 static site with a WebGL hero on the home page, built to rank and to
pass Core Web Vitals on phones. The first-generation site in `../phils-auto-fleet-repair/` is
untouched and still deployable.

## Assumptions made (the brief left these blank)

- Business facts, services, guides and the four real reviews come from the v1 generator's data,
  exported to `src/data/site.json`. Rating 4.4 / 83 reviews must be re-checked against Google
  before launch (see `seo/launch-checklist.md`).
- No 3D assets were supplied; every 3D element is procedural. The badge logo is an 80 px PNG.
- No competitor or reference sites were supplied.
- Brand feel: dark, cinematic, industrial. Indigo from the logo is the one saturated colour.
- Stack: Astro + React islands (not Next.js) so inner pages ship no React. Fonts: Space Grotesk
  (display) and Inter (text), self-hosted Latin subsets.
- No Tailwind. It was in the brief, but the site uses a hand-written stylesheet (`legacy.css` +
  `global.css`) and no utility classes, and Tailwind 4's generated prelude (`@layer`, `@property`,
  `color-mix`) was dropped wholesale by the WebKit build inside the iOS preview viewer, leaving
  pages unstyled there. Plain CSS renders everywhere.
- Deploy target: Netlify. The quote form posts to the existing FormSubmit endpoint (already
  confirmed for the shop's inbox in v1) with two honeypot fields; Netlify Forms would need the
  site to be on Netlify first.
- The WebGL scene runs only on desktops (≥ 881 px) with GPU tier 2+. Phones get the plain video
  hero by design; that is what keeps mobile Lighthouse in the 90s.

## Run, build, deploy

```bash
npm install
npm run dev        # http://localhost:4321
npm run og         # regenerate the per-page Open Graph images (needs Chromium via Playwright)
npm run build      # static output in dist/
npm run preview    # serve dist/ locally
```

Deploy: Netlify → Import from Git → base directory `sites/phils-auto-v2`, build `npm run build`,
publish `dist`. `netlify.toml`, `public/_headers` (cache + CSP) and `public/_redirects` (301 map
from the old site's URLs) are picked up automatically. Vercel works the same way with the
`dist` output directory; `_headers`/`_redirects` would need converting to `vercel.json`.

Test the hero without a capable GPU: append `?gpu=3` to force the WebGL scene, `?gpu=0` to force
the poster-and-video version. The chosen tier is logged to the console.

## Where things live

```
src/data/site.json          business facts, services, guides, reviews, FAQs, redirects, icons
src/data/guides-v2.ts       the two advice posts written for v2
src/lib/seo.ts              typed access to the data + JSON-LD builders
src/layouts/Base.astro      head (SEO, OG, hreflang, JSON-LD), header, footer, scripts
src/components/             Header, Footer (with the mobile call bar), PageHead, QuoteForm, …
src/components/home/        Hero.astro (video + DOM text + beats), Scene3D.tsx (WebGL), RippleImage.tsx
src/scripts/hero-story.ts   scroll story controller + GPU tiering + lazy load of Scene3D
src/scripts/ui.ts           Lenis, split-text, reveals, magnetic buttons, custom cursor
src/scripts/legacy.js       nav toggle, tracking events, quote form, video autoplay fallbacks
src/styles/global.css       fonts, tokens, hero stage, beats, cursor, marquee
src/styles/legacy.css       the v1 component styles (cards, forms, footer, …)
src/pages/                  one file per page; services/[slug] and advice/[slug] are generated
public/assets/video/        the hero clip; public/assets/img/ posters and photos; public/assets/og/ per-page OG images
public/fonts/               self-hosted woff2 subsets
seo/keyword-map.md          one keyword family per URL, titles, metas, cannibalization notes
seo/launch-checklist.md     GBP, Search Console, analytics, citations
design/concept.md           the 3D concept, scroll storyboard, colour and type system
perf/lighthouse.md          real Lighthouse output and what the perf pass changed
```

## Add a page

- **A service:** add an object to `services` in `src/data/site.json` (copy an existing one:
  `slug`, `nav`, `icon`, `title`, `h1`, `meta`, `blurb`, `intro`, `includes`, `signs`, `faqs`).
  The service page, its card on the home and services pages, the footer link, the quote-form
  dropdown, the sitemap and the JSON-LD all follow. Run `npm run og` for its share image.
- **An advice post:** add an object to `extraGuides` in `src/data/guides-v2.ts` (same shape as
  the v1 guides: `sections` are `[heading, "p" | "ul", items]`). Then `npm run og`.
- **A standalone page:** create `src/pages/<name>.astro`, wrap it in `Base` with `title`,
  `description`, `path` and `schemas={[breadcrumb(trail)]}`, and use `PageHead` for the header.
  Add it to `seo/keyword-map.md` and give it an entry in `scripts/og-images.mjs`.

## Swap the video or the 3D

- **Video:** replace `public/assets/video/shop-bay.mp4` (H.264, no audio, `-movflags +faststart`,
  16:9, ≤ 3 MB) and `public/assets/img/shop-bay-poster.jpg` (first frame). Regenerate the AVIF
  and WebP posters with ffmpeg (`-c:v libaom-av1 -still-picture 1 -crf 34` / `-c:v libwebp
  -quality 78`) and run `npm run og`. No code changes.
- **3D parts:** `Scene3D.tsx` has three components, `Rotor`, `Piston`, `Bolts`, each wrapped in
  `<Part window={[start, end]}>` which controls when in the scroll story it crosses the scene.
  Replace the geometry inside one of them, or drop a GLB in `public/assets/3d/` and load it with
  `useGLTF` from drei (drei was removed to save weight; add it back only for that page).
- **Story beats:** the four text panels are in `Hero.astro` (`data-beat="0..3"`); the thresholds
  are quarters of the 320 vh track, set in `scripts/hero-story.ts` (`setBeat`).
- **Materials and lighting:** `steel`, `brushed`, `dark` constants and the `Studio` component in
  `Scene3D.tsx`.

## Performance rules that the code enforces

- Canvas mounts only after `load` + idle, only at GPU tier 2+, only on desktops. DPR capped at 1.5.
  Render loop stops when the hero is off-screen or the tab is hidden.
- The video `<source>` is attached after `load` so the poster (LCP) wins the bandwidth race.
- Fonts: `font-display: optional` with metric-matched fallbacks, two files preloaded (no CLS).
- Inner pages load about 54 KB of JS gzipped (GSAP + Lenis + interactions), no React.
- `prefers-reduced-motion`: no smooth scroll, no split-text, no cursor, no scroll story.

Numbers and caveats are in `perf/lighthouse.md`.
