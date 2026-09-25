# Cali Tints — Sacramento, CA

Built from `blueprint/MASTER-BLUEPRINT.md`. Astro 5, plain CSS, video hero,
GSAP + Lenis, self-hosted fonts, JSON-LD, `llms.txt`, IndexNow, marketing kit.

**This is the blueprint's reference implementation** — copied from
`sites/automotive-solutions-v2` (on branch `claude/automotive-solutions-site-fqxf20`),
which superseded `sites/phils-auto-v2`. The blueprint's opening line now points here.
The next site starts with `cp -r sites/cali-tints sites/<slug>`.

```bash
npm install
npm run build          # -> dist/
npm run og             # per-page OG images (run AFTER build)
node scripts/audit.mjs # gate: exits non-zero on any failure
node scripts/lh.mjs    # Lighthouse mobile -> perf/lighthouse.md
npm run contrast       # hero copy vs what is behind it, frame by frame
node scripts/shots.mjs      # QA screenshots -> qa/
npm run video -- clip.mov   # encode a new hero clip to spec + recut posters
npm run posters        # hero poster set only (jpg/webp/avif)
node scripts/preview-relative.mjs   # -> dist-preview/ (sub-path safe)
node scripts/indexnow.mjs --send    # push the sitemap to Bing
```

Every business fact lives in `src/data/site.json`. Adding a service or a guide is
a data change plus `npm run build && npm run og`.

## Preview on GitHub Pages

`.github/workflows/deploy-phils-site.yml` builds this site on every push to the
listed branches and publishes it **under `/cali-tints/`** on the repo's Pages
site (Phil's Auto keeps the root; a repo has one Pages site):

    https://therealmacintosh52-collab.github.io/curly-octo-rotary-phone/cali-tints/

It uses the relative-URL copy from `scripts/preview-relative.mjs`, so every link,
font, poster and the video resolve from the sub-path. One-time setup by the repo
owner: **Settings → Pages → Build and deployment → Source: GitHub Actions.** Until
that is set the `deploy` job fails in a second with "Get Pages site failed".

Pages is the shareable preview, not production: it cannot serve `_headers` or
`_redirects`, and the canonical URLs still point at `calitintsca.com`. Production
is Netlify (base directory `sites/cali-tints`, build `npm run build`, publish `dist`).

---

## Where things are

```
src/data/site.json      all business facts: 12 services, 5 guides, 3 reviews,
                        6 FAQs, 10 areas, the three home pillars, profile URLs
src/lib/seo.ts          schema builders. @type = LocalBusiness + knowsAbout
src/layouts/Base.astro  head, preloads, JSON-LD, chrome
src/components/         VideoHero, QuoteForm, Glance, StatBand, Faq, …
src/scripts/site.ts     nav, tracking, forms, hero autoplay, GSAP/Lenis
src/styles/legacy.css   tokens + components (green/black, contrast-verified)
src/styles/global.css   @font-face, video hero, motion, At a glance, Short answer
public/fonts/           self-hosted woff2 — never a runtime CDN
public/assets/video/    shop.mp4 + shop.webm (the hero clip)
public/assets/img/      logo.png (256), logo-800.png, apple-touch-icon.png,
                        favicon.svg, hero-poster.{jpg,webp,avif}
scripts/                build, audit, perf and asset tooling
seo/ perf/ marketing/   keyword map, launch checklist, Lighthouse, the kit
qa/                     screenshots (gitignored; regenerate with shots.mjs)
```

## Scores

`node scripts/lh.mjs`, throttled mobile, against the built `dist/` — the current
numbers are in `perf/lighthouse.md`. `node scripts/audit.mjs` passes with 0 errors
and 0 warnings across 26 pages: one H1 each, heading order, unique titles ≤ 60
and descriptions 70–160, valid JSON-LD with no aggregateRating, every internal
link and anchor resolving, alt text everywhere, one phone number everywhere,
sitemap coverage, and text contrast measured against the background each
element renders on. `npm run contrast` reads 7.32:1 on every frame of the clip
(needs 4.5:1), and the number is identical frame to frame, which is the proof
that nothing is laid over the video.

---

## What was assumed, and where it came from

Nothing on the site is invented, but most of it came from public listings and the
owner's pasted Google card rather than from the shop directly. Confirm each before
launch; `seo/launch-checklist.md` has the sequence.

| # | Item | Source | Action |
|---|---|---|---|
| 1 | **Shop email** | Not published anywhere | **Blocking.** Set `site.email`, rebuild, click the FormSubmit confirmation. Until then the form tells visitors to call rather than pretending to send. |
| 2 | Name, address, phone | Google card pasted by the owner, 2026-09-25 | Settle `# F` (Google) vs `Suite F` (this site) one way, everywhere |
| 3 | **Hours: Monday – Friday 10:00 AM – 6:00 PM, Saturday 10:00 AM – 4:00 PM, closed Sunday** | Owner's choice; matches Google "closes 6 PM" and two directories. **Yelp says Monday – Friday 10:00 AM – 7:00 PM, Saturday 11:00 AM – 5:00 PM.** | Confirm; fix whichever listing is wrong |
| 4 | 4.9 from 48 Google reviews | The Google card, read 2026-09-25 | Re-read before launch; update `rating` / `review_count` / `rating_checked` |
| 5 | Three quoted reviews | The three snippets on the Google card, verbatim, reviewer names as shown | Add a fourth; the blueprint asks for four |
| 6 | Twelve services | Owner's 11-category list + the Google listing's service list | Confirm "inspections & mechanical" is work the shop wants to advertise |
| 7 | Domain `calitintsca.com` | Search result; the site could not be crawled from here | Confirm, and whether `www` is canonical |
| 8 | Redirects | Old page list unknown | **Fill `public/_redirects` from Search Console before launch** |
| 9 | Instagram | The Google card links one; URL not visible | Add to `profiles` in `site.json` |
| 10 | Geo 38.5995, −121.4014 | Geocoded from the street address | Fine-tune from the listing |
| 11 | Ten towns served | Neighbouring cities, nearest first | Confirm the shop wants all ten |
| 12 | Film brands, warranty terms | Not published | Add to the tint and PPF pages once named — strong content |
| 13 | "Cali Tints Revolutions" | Owner's draft copy | Left out. If it is a real product line, name the film and what it rejects |
| 14 | Photos | None supplied | Storefront with the sign, the bay, work in progress, finished cars |
| 15 | California tint law figures | CA Vehicle Code §26708: 70% VLT front sides, AS-1 strip, any shade rear, dual mirrors, medical exemption | Stable, but re-check yearly; the guide says it is not legal advice |

## Decisions that differ from the blueprint

1. **`LocalBusiness`, not `AutoRepair`.** Window tinting has no schema.org
   subtype and this is not a repair shop. Per the blueprint's own "anything else"
   row: `LocalBusiness` + `knowsAbout[]` + `hasOfferCatalog`.
2. **No `aggregateRating` in the JSON-LD.** Carried over from the reference:
   Google treats self-marked-up ratings as self-serving and can drop the rich
   result. The rating is plain text linked to the listing, and `scripts/audit.mjs`
   fails the build if `aggregateRating` ever appears.
3. **Three reviews, not four.** Three verbatim quotes exist. A fourth was not
   invented. One of the three includes a criticism about pickup timing; it stays.
4. **No 3D island, no `/es/`.** The clip is the hero; WebGL would cost LCP and
   win nothing. No second language was listed on the intake, so the Spanish page
   was not built and the schema declares `knowsLanguage: ['en']`.
5. **A `pillars` block in `site.json`.** The owner supplied three paragraphs
   (Tints / Wraps-PPF / Detail-Ceramic). They became a three-card section on the
   home page above the twelve-service grid, driven from data like everything else.

---

## Brand

The palette is sampled from the badge logo: leaf green `#80d850` inside a black
disc with a grey ring `#686868`. That green is too light to carry text on white
(1.9:1), so:

- `--accent` / `--accent-dk` are darker greens (`#2a7a1a` 5.4:1, `#1f6b12` 6.6:1)
  for buttons and link text on white;
- `--accent-vivid` (`#80d850`) and `--accent-lt` (`#9be86a`, 13:1 on the dark
  ground) carry eyebrows, icons and the H1 highlight on dark sections;
- the darks are neutral black with a faint green cast (`--ink #0b0f0b`), not the
  reference's indigo.

Everything is a custom property in `src/styles/legacy.css` `:root`; the OG and
poster scripts carry their own copies of the gradient and were updated to match.

The logo is round, so the header and footer use the badge beside the name
(`.brand-badge` + `.brand-text`). The name is set the way the badge sets it —
uppercase display type in the logo green on a black band with the grey ring
(`.brand-word`) — so the header reads as the logo rather than as a caption next
to it; the footer inverts it to black on green. Hours and day names are never
abbreviated anywhere on the site (owner's instruction): `hours_short` in
`site.json` is the full string and every component reads it.
`logo.png` is 256 px for the header; `logo-800.png` is the master and feeds the
manifest and the JSON-LD `logo`. Both were cut from the supplied JPG with the
white ground made transparent. An SVG from the owner would be better.

Fonts: Space Grotesk + Inter, the blueprint's pairing for auto and trades,
already self-hosted in `public/fonts/` with metric fallbacks.

---

## The hero video

**In and live.** `public/assets/video/shop.mp4` (1.63 MB) + `shop.webm` (1.81 MB),
the full 6.9 s, silent, encoded with `npm run video` from the owner's `.mov`
(1280×720 H.264 + AAC source). **No trim.** Posters are cut from frame 1.

### What is in the footage

It is AI-generated, not the real shop, and shipped whole by the owner's decision.
Recording what is on screen so nobody rediscovers it:

- A technician kneels beside a **black BMW 2-series coupe** with a machine
  polisher — a **detailing / paint-correction scene, not a tint install**. The
  polisher's body reads "CALI TINTS".
- The **green palm-tree badge**, matching the real logo, glows on the wall
  **top-centre** of the frame. It is the most on-brand thing in the clip and the
  reason the band runs uncropped.
- Sunset, corrugated steel building, roll-up doors. **No phone number, no
  address, no street sign** anywhere in frame — nothing contradicts the site.
- The camera holds; the loop is a slow drift. First and last frames are near
  enough that the hard loop does not jump.

Ten seconds shot in the real bay would replace it and add the real storefront:

```bash
npm run video -- ~/real-clip.mov     # + --start/--end/--speed/--pingpong if raw
npm run build && npm run og && node scripts/audit.mjs && npm run contrast
```

`hasVideo={true}` and `focus="50% 30%"` are already set in `src/pages/index.astro`.

### How it behaves

Inherited from the reference, unchanged:

- The band is `aspect-ratio: 16 / 9`, the clip's own ratio, so `object-fit: cover`
  crops nothing and the badge is on screen at every width. `focus` only governs
  the poster if the ratio is ever changed. On a 1440×900 laptop the frame is
  810 px tall and the headline sits below the fold; the sticky header keeps the
  phone number and *Get a Quote* on screen, and the mobile call bar does the same
  on phones, where the frame is 219 px tall and the call button is above the fold.
- Nothing is laid over the clip. The copy sits on the dark gradient beneath it.
  `npm run contrast` is the regression test: identical numbers frame to frame.
- The poster is a real `<img>`, preloaded, so it is the LCP; the video source is
  attached after `load`. `muted` is set in JS as well as markup; `play()` is
  retried on `canplay`, `loadeddata`, `pageshow`, visibility change and the first
  gesture. If it is still refused (iPhone Low Power Mode), the poster stays and a
  "Tap to play" pill appears. The video pauses off-screen.
- WebM/VP9 first, H.264 MP4 second, negotiated with `canPlayType`. The headless
  Chromium in this container has no H.264 decoder, which is why the WebM is what
  makes the autoplay path testable here.

### Verified

| | Result |
|---|---|
| Autoplay, default Chrome policy | plays, `readyState 4`, `is-playing` set |
| Autoplay refused (`--autoplay-policy=user-gesture-required`) | poster stays, tap cue shown, no false "playing" |
| Hero copy vs the brightest pixel behind it, every second (`npm run contrast`) | worst 7.32:1, needs 4.5:1, identical at every frame |
| Audio | stripped (`-an`) |
| Horizontal overflow at 390 px | none |

---

## Only the owner can do these

1. Supply the email, then click the one-time FormSubmit confirmation link.
2. Confirm the hours and fix whichever of Google or Yelp is wrong.
3. Export the old site's URLs and fill the redirect map.
4. Update the Google Business Profile — categories, all twelve services, photos,
   website link — and make name/address/phone/hours match this site exactly.
5. Supply photos and, when convenient, a real clip of the bay.
6. Name the films installed and their warranty terms.
7. Ask customers for reviews. See `marketing/review-request-templates.md`.
