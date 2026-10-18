# Build notes: Stage 4

## What was built
25 pages exactly as `strategy/SITE-ARCHITECTURE.md` (home; six service pages; photo-quote; dealers-and-fleets; guides index + 4 guides; service-area hub + Sacramento, Elk Grove, Roseville, Folsom; about, contact, FAQ, privacy, terms; 404), 24 indexable. Generator `build.py` + `build/` (config, page modules, CSS, JS, fonts, images) -> `public/` (146 files, 4.2 MB, of which 1.6 MB is the hero scrub set). Also: `sitemap.xml` (24 URLs), `robots.txt`, `llms.txt`, `humans.txt`, `_headers` (strict hash-based CSP), `_redirects`, `site.webmanifest`, favicons, IndexNow key file, 24 share images (`/og/<page>.png`, Chromium render with the site fonts, palette-quantized). Tools: `stamp.py`, `lint.py`, `check.py`, `serve.py`, and test scripts. Spanish: none (S-05). No third-party script, font, tracker or cookie.

Hero: poster frame 0 is the LCP `<img>` (AVIF/WebP, explicit dimensions, `fetchpriority=high`, media-gated preloads); 31 AVIF scrub frames load after `load` and idle (measured 589 KB mobile, 471 KB desktop); static final frame for reduced motion, JS off, Save-Data, slow or low-end devices; caption "Illustration. Not a customer vehicle." Deviations from the brief are S-31 to S-43 in `ASSUMPTIONS.md`.

## Measured (local static server with the real `_headers`, gzip; Lighthouse 12 mobile preset, simulated slow 4G; medians)
Home, 5 runs: `{"perf":100,"a11y":100,"bp":78,"seo":100,"lcp_s":1.58,"cls":0,"tbt_ms":12,"kb":710}`
Paintless dent repair (service template), 5 runs: `{"perf":100,"a11y":100,"bp":78,"seo":100,"lcp_s":1.28,"cls":0,"tbt_ms":0,"kb":62}`
3 runs each, all medians perf 100, a11y 100, seo 100, CLS 0, TBT 0 ms: photo-quote (LCP 1.21 s, 63 KB), guide (1.28 s, 61 KB), city page Elk Grove (1.28 s, 60 KB), dealers (1.20 s, 64 KB), privacy (1.20 s, 60 KB).
Desktop preset, 3 runs: home perf 100 / a11y 100 / bp 78 / seo 100, LCP 0.36 s; photo-quote LCP 0.31 s.
404 page: SEO 69 by design (noindex plus a 404 status fail `is-crawlable`).
**Best Practices 78 is a local-http artifact**: the only failing audits are `is-on-https` and `redirects-http`; every other audit passes. I could not run it over HTTPS here (a self-signed cert is rejected by the Lighthouse interstitial), so BP on the deployed host is *expected* to be 100 but is **not verified**. The home page's 710 KB is mostly the idle-loaded scrub frames (not on the critical path); inner pages are about 60 KB.
INP: no field or lab INP measured (no interaction trace); the page's JS is 3 small files, no layout work in handlers. Not verified.

axe-core 4 (wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice) on all 25 pages at 390 and 1280 with every `<details>` open: **0 violations** after the fix below. "Incomplete" color-contrast items are text over the hero image and gradient text; replaced by pixel sampling.
`tools/hero-contrast.mjs` (p99 background luminance under each hero text box at 4 scroll states at 390 and 3 at 1280, plus reduced motion): all pass. Lowest: gradient line 3 at 3.52:1 to 4.01:1 (large text needs 3), Ivory text 12:1 to 17:1, button labels are token pairs (8.20:1). `strategy/contrast-check.py` still passes.
`tools/probe.mjs` computed-opacity probe (JS off, reduced motion, scrolled, and hero.js blocked then 8 s wait): **0 hidden text elements** in all cases at 390 and 1280. The only conditional hiding is `html.scrub` lines 2 and 3 of the hero H1, set by a head script and removed by a 7 s failsafe if `hero.js` has not reported `live`.
Forms (Playwright, endpoint mocked): empty submit gives an error summary and four flagged fields; honeypot filled sends nothing; valid submit POSTs once and shows success; `?for=fleet` presets "Dealer or fleet". Unstamped, the submit button is `disabled` in the markup and the notice says "This form isn't connected yet".
Structural check (`tools/check.py`): 25 pages, 0 errors: balanced HTML via parser, lang, one H1, titles 28 to 57 characters and unique, descriptions 110 to 165 characters and unique, canonical on every page, answer paragraph 40 to 60 words on every page, heading order, unique ids, image alt and dimensions, labelled controls, no broken internal link or anchor, no orphan, at least two links to /photo-quote/ per page, keyword-anchor rule, no sideways city links, sitemap parity, JSON-LD parses (no address, priceRange, offers, AggregateRating or Review; telephone matches; every FAQPage question is visible text). Not run: a real HTML validator (Java not installed), so "valid HTML" is parser-level only.
Lint: unstamped production lint fails on tokens and markers only (`{{DOMAIN}}`, `{{FORM_ENDPOINT}}`, `{{FORM_ORIGIN}}`, `{{ANALYTICS_ID}}`, phone-status, form-not-connected): 0 banned-claim hits, 1 allowlisted hit. A copy stamped with a test domain, endpoint, `--analytics none` and `--phone-confirmed` passes `tools/lint.py` ("lint ok") and all tokens are gone.

## Defects found and fixed
- First hero test hid the dent under the copy and a heavy scrim: moved the image down 20%, buttons to the thumb zone, lighter mid scrim.
- Desktop hero had the panel on the wrong side and "Paint glowing." wrapped: reordered, smaller H1 clamp.
- Hero caption and eyebrow failed pixel contrast (Steel on image 2.3 to 4.5:1): now Ivory.
- JS-off hero had no scrim and an inline noscript style blocked by the CSP: hash added; scrim kept.
- axe `region`: the sticky bar was not in a landmark: now `<nav aria-label="Quick contact">`.
- Markdown links printed literally in four raw-HTML blocks; source lists sat outside the page gutter; two-button bar label wrapped: fixed.
- Banned words in copy ("bonded", "best", "years") found by the lint and rewritten; the "years" rule was narrowed to the plural claim and "N year" so "model year" is allowed.
- Sticky bar could intercept the Send tap when a field blurred: `scroll-padding-bottom` and a delayed un-hide.
- Guide answer was 63 words (limit 60): cut. `photo_card` ids used Python `hash()` (non-deterministic builds): now `crc32`.

## Open
- Nothing is stamped; every TO-CONFIRM item stands. New this stage: #25 form host and CSP, #26 unsourced advice sentences and behavior promises, #27 crawler names to re-verify.
- City pages are written only from the source ledger and are not map-checked; Roseville has the least place-specific material (330 body words, part generic).
- Share images carry only the page title and a generic line; regenerate them after any title change (`build/cache/og` is keyed to the titles).
- BP on HTTPS, INP, a real HTML validator run, `hreflang` (none needed), and a human visual pass on a real phone are not done. Stage 6 still owns the keyboard-path check and the 768 px screenshots; I viewed 390 and 1280 only (home, PDR, photo-quote; JS-off and reduced-motion home).
- `HERO_IS_REAL_JOB`, `REVIEW_URL`, hours, email and prices are intentionally absent from the output.
