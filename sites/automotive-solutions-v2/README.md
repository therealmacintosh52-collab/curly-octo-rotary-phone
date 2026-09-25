# Automotive Solutions by Single — v2

Built from `blueprint/MASTER-BLUEPRINT.md`. Astro 5, plain CSS, video hero,
GSAP + Lenis, self-hosted fonts, JSON-LD, `llms.txt`, IndexNow, marketing kit.

**This is also the blueprint's reference implementation.** The blueprint says to
`cp -r sites/phils-auto-v2 sites/<slug>`, but no such folder existed in this
repo — there was no Astro project here at all. So this was built from the
blueprint's spec directly, and it is what the next site should be copied from.
Update the blueprint's opening line to point at `sites/automotive-solutions-v2`.

```bash
npm install
npm run build          # -> dist/
node scripts/audit.mjs # gate: exits non-zero on any failure
node scripts/lh.mjs    # Lighthouse mobile -> perf/lighthouse.md
npm run og             # per-page OG images (run AFTER build)
npm run posters        # hero poster set (jpg/webp/avif)
npm run video -- clip.mov   # encode the hero clip to spec + recut posters
npm run contrast       # hero copy vs what is behind it, frame by frame
node scripts/shots.mjs      # QA screenshots -> qa/
node scripts/preview-relative.mjs   # -> dist-preview/ (sub-path safe)
node scripts/indexnow.mjs --send    # push the sitemap to Bing
```

Every business fact lives in `src/data/site.json`. Adding a service or a guide is
a data change plus `npm run build && npm run og`.

---

## Where things are

```
src/data/site.json      all business facts: 12 services, 5 guides, reviews,
                        FAQs, areas, 38 redirect pairs, profile URLs
src/lib/seo.ts          schema builders. @type = AutoRepair
src/layouts/Base.astro  head, preloads, JSON-LD, chrome
src/components/         VideoHero, QuoteForm, Glance, StatBand, Faq, …
src/scripts/site.ts     nav, tracking, forms, hero autoplay, GSAP/Lenis
src/styles/legacy.css   tokens + components (ported from v1, contrast-verified)
src/styles/global.css   @font-face, video hero, motion, At a glance, Short answer
public/fonts/           self-hosted woff2 — never a runtime CDN
public/assets/video/    shop.mp4 goes here
scripts/                build, audit, perf and asset tooling
seo/ perf/ marketing/   keyword map, launch checklist, Lighthouse, the kit
qa/                     screenshots at 1440×900, 1920×1080, 390×844 + nav open
```

## Scores

`node scripts/lh.mjs`, throttled mobile, against the built `dist/`:

| Page | Perf | A11y | Best prac. | SEO | LCP | CLS |
|---|---|---|---|---|---|---|
| Home | 99 | 100 | 100 | 100 | 2.1 s | 0 |
| Service | 99 | 100 | 100 | 100 | 1.8 s | 0 |
| Guide | 99 | 100 | 100 | 100 | 1.8 s | 0 |
| Contact | 99 | 100 | 100 | 100 | 1.8 s | 0 |

`node scripts/audit.mjs` passes with 0 errors and 0 warnings across 26 pages:
one H1 each, heading order, unique titles ≤ 60 and descriptions 70–160, valid
JSON-LD, every internal link and anchor resolving, alt text everywhere, one phone
number everywhere, sitemap coverage, and text contrast measured against the
background each element actually renders on.

---

## The hero video

**In and live.** `public/assets/video/shop.mp4` (2.26 MB) + `shop.webm` (2.54 MB),
the full 10.0 s, silent. **No trim.** The owner supplied it to be used whole.

The clip runs: the shop's neon logo animates in over the storefront (~0.5–2.5 s),
then the camera pushes through the roll-up door into the bay and holds there.

### Do not trim the opening — the logo is the point

An earlier encode started at 3.0 s and a later one at 5.25 s, on the reading that
the logo over the first ~2.7 s was a generation watermark. **It is not.** It is
the shop's own orange-and-blue logo animated into the footage deliberately, and
cutting it threw away the most on-brand seconds in the clip. That mistake cost
two rounds. If the clip is ever re-encoded, run `npm run video` with no `--start`
unless the owner asks for a cut.

`--start`/`--end`/`--speed`/`--pingpong` still exist in `scripts/encode-video.mjs`
for genuinely raw footage. They are not used here.

### What is in the footage

It is AI-generated, not this building, and it was reviewed and shipped as-is by
the owner's decision. Recording what is on screen so nobody rediscovers it:

- **The sign on the building reads `916-000-5277`.** The shop's real number is
  **(916) 686-5277** — the middle three digits are wrong. Now that the frame runs
  uncropped it is in view at every width, though the logo animation covers much
  of it for the first couple of seconds.
- The logo on that small building sign is maroon rather than the real orange and
  blue, and "SOLUTIONS" under it is garbled. The address line is illegible. This
  is the *painted sign in the shot*, not the animated logo overlay, which is
  correct.
- A **"DIESEL REPAIR"** sign is on the wall. This shop does not claim diesel.
- The neighbouring "blush salon" sign is real — Blush Salon & Spa does share
  that address.

Everywhere on the site the phone number is correct and identical;
`scripts/audit.mjs` enforces that. The number in the video is the one place it
is wrong, and no text on the page repeats it.

**Ten seconds shot on a phone at the real shop** would replace the whole thing
and remove every item above:

```bash
npm run video -- ~/real-clip.mov
```

Nothing in the code changes; run `npm run contrast` and `npm run audit` after.

### Swapping a new clip in

```bash
npm run video -- ~/the-raw-clip.mov          # + --start/--end/--speed/--pingpong
# hasVideo={true} and focus="…" are already set in src/pages/index.astro
npm run build && npm run og && node scripts/audit.mjs
```

**Clip spec to give whoever shoots it:** landscape 16:9, 1920×1080 source, 6–12
seconds, loops cleanly (end frame near the start frame), slow and steady, one
subject, the shop sign or storefront somewhere in frame, no text, no close-up
faces, no fast pans. Audio is stripped in the encode.

**How it behaves.** The poster is a real `<img>`, preloaded, so it is the LCP —
the video source is not attached until after `load` and therefore never competes
with it. `muted` is set in JS as well as in markup, because some iOS builds ignore
the attribute alone and refuse the autoplay. Play is retried on `canplay`,
`loadeddata`, `pageshow`, visibility change and the first gesture. If it is still
refused — iPhone Low Power Mode is the usual reason — the poster stays and a
"Tap to play" pill appears. The video pauses when scrolled off-screen.

### The clip runs its full 16:9 — nothing is cropped

`.hero-v__media` carries `aspect-ratio: 16 / 9`, which is the clip's own ratio,
so `object-fit: cover` has nothing to crop and the whole frame is on screen at
every width. `focus`/`--hero-focus` is therefore a no-op for the video; it still
governs the poster if the band ratio is ever changed.

An earlier version sized the band off viewport height
(`clamp(210px, 32svh, 400px)`) to keep the call button above the fold. It looked
tidier but it cut the top and bottom off the shot — including most of the logo
animation. **The cost of not cropping:** on a 1440x900 laptop the frame is
810px tall, so the headline and the call button sit below the fold. The sticky
header keeps the phone number and *Get a Quote* on screen throughout, and the
mobile call bar does the same on phones, where the frame is only 219px tall and
the headline and call button are both above the fold.

To trade back: give `.hero-v__media` a `max-height` and either accept the crop
(`object-fit: cover`) or letterbox it (`object-fit: contain` on `--grad-dark`).

### Nothing is laid over the clip, at any width

The clip is a band across the top of the page with the copy on solid ground
beneath it — the same structure on a phone and on a 2560px monitor. There is no
scrim, no gradient and no nav over the picture: `.hero-v__scrim` is
`display: none` and the home page does not pass `navOver`, so the header sits
above the band on its own ground rather than on the frame.

That is a compositional answer to a problem four rounds of gradient tuning could
not solve. While the copy sat on the frame, any overlay dark enough to make it
readable also dimmed the shot — a full-height band needed ~95% opacity across
60% of the width, and an ellipse centred on the copy is still a vignette. A
two-column split (copy left on a dark panel, video right) fixed the contrast but
left a hard seam and a large flat panel next to the picture. Stacking removes
the constraint instead of balancing it: no overlay exists, so no frame — bright
or dark — can ever be a problem.

`npm run contrast` is the regression test for this. Every row of its table
should read the **same** number from second to second; a column that moves means
something has been put back over the video.

Two things the layout has to hold, both measured rather than eyeballed:

- **The call button must clear the fold**, and a 1366×768 laptop is as wide as a
  desktop with 130px less height. The media band is therefore sized off viewport
  height (`clamp(210px, 32svh, 400px)`), with a `max-height: 840px` query that
  tightens the headline and the spacing. Checked at 1280×720, 1366×768,
  1440×900, 1536×864, 1920×1080, 390×844 and 414×896.
- **`.wrap` centres with `margin: 0 auto`.** Inside `.hero-v__inner`, which is a
  flex column, that is a *cross-axis* auto margin — so the box shrank to fit its
  own longest line and the hero copy centred on itself instead of lining up with
  the logo and the stat band. `.hero-v__inner .wrap { width: 100% }` puts it back
  on the page grid.

The three trust lines (hours, ASE, NAPA) sit in the right-hand column of the
copy block rather than as a strip under the buttons: it fills what would
otherwise be 40% empty panel, gives them more weight than fine print, and taking
a row out of the left column is what buys the call button its clearance at 720px.

One more trap: `.hero-v` is a `<section>`, and the global `section` rule puts
~94px of vertical padding on it, which shows up as dead space above the clip.
`padding: 0` on the hero.

Two formats are shipped and negotiated at runtime with `canPlayType`: WebM/VP9
first (smaller, taken by Chrome, Firefox, Edge and Android), H.264 MP4 second
for Safari and iOS. If neither decodes, the poster simply stays.

**With no clip present** the poster falls back to a flat dark texture and the
mobile media band collapses (`.hero-v--noclip`) so nothing is pushed down by
empty space. `hasVideo={false}` restores that state.

### Two traps worth knowing about, both cost time here

1. **Do not use the ffmpeg bundled with Playwright** (`/opt/pw-browsers/ffmpeg-*`).
   It is a stripped build for WebM screen recording: matroska/webm demux and VP8
   decode only, no MP4 container and no H.264. Handed a normal phone clip it says
   `Invalid data found when processing input`, which reads exactly like a corrupt
   file and is not one. `scripts/ffmpeg-path.mjs` resolves `ffmpeg-static` instead.
2. **The headless Chromium here has no H.264 decoder** — it is the open-source
   build, and `canPlayType('video/mp4; codecs="avc1.42E01E"')` returns empty. An
   MP4-only hero is therefore untestable in this container and looks broken when
   it is fine. Shipping the WebM alongside is what makes the autoplay path
   verifiable, and it is smaller for most visitors anyway.

Also: the test server must support HTTP **Range** requests and pages with video
must wait for `load`, not `networkidle` — a streaming video means the network
never goes idle. Both are handled in `scripts/`.

### Verified

| | Result |
|---|---|
| Autoplay, default Chrome policy | plays, `readyState 4`, `is-playing` set |
| Autoplay, `--autoplay-policy=document-user-activation-required` | still plays |
| Autoplay refused (Low Power Mode simulated) | poster stays, tap cue shown, no false "playing" |
| Hero copy vs the brightest pixel behind it, every second of the clip (`npm run contrast`) | worst 7.50:1, needs 4.5:1 — and identical at every frame, which is the proof nothing overlays the video |
| Call button above the fold, 7 viewport sizes | clears at all 7 |
| Audio | stripped (`-an`) |
| Wrong phone number from the storefront sign in frame | visible at every width now that the frame is uncropped — shipped as-is by the owner's decision |

---

## Decisions that differ from the blueprint

Three, all deliberate:

1. **No `aggregateRating` in the JSON-LD.** The blueprint's standards table asks
   for it. Google's guidelines treat a business marking up its own reviews as
   self-serving and sites doing it risk losing the rich result entirely. You
   confirmed this call. The rating is stated in plain text and linked to the
   Google listing that calculated it, and `scripts/audit.mjs` **fails the build**
   if `aggregateRating` ever appears. Consider updating the blueprint so the two
   documents stop contradicting each other.

2. **One quoted review, not four.** The blueprint asks for four real reviews.
   Exactly one verbatim quote exists that can be pointed at. Three were not
   invented. The reviews page carries the one quote plus three cards that are
   plainly statements about the business, styled differently so they cannot be
   mistaken for customer quotes.

3. **No 3D island.** The blueprint makes it optional and says to skip it unless
   the niche has physical objects worth modelling. A customer with a broken car
   is choosing a shop in under five minutes; WebGL would cost LCP and win nothing.
   Dropped, along with react/three/r3f.

Also: `/es/` is not built yet. The blueprint turns it on by default for a
consumer trade in California and the schema already declares
`knowsLanguage: ["en","es"]`. It needs a translated home page plus reciprocal
`hreflang` — say the word and it is an hour's work.

---

## Confirm before launch

Nothing here is invented, but these came from public sources rather than from the
owner. `seo/launch-checklist.md` has the full sequence.

| # | Item | Source | Action |
|---|---|---|---|
| 1 | **Shop email** | Not published anywhere | **Blocking.** Set `site.email`, rebuild, click the FormSubmit confirmation. Until then the form tells visitors to call rather than pretending to send. |
| 2 | **Hero video is AI-generated, not the real shop, and its storefront sign shows a wrong phone number** | The supplied clip, used whole by the owner's decision | Shoot 10 s at the real shop and re-run `npm run video`. See above. |
| 3 | Hours Mon–Fri 9–6 | NAPA, Yelp and the old site agree | Confirm Saturdays |
| 4 | Since 2001 | automotivesolutionsbysingle.com | Confirm — directories loosely say "15 years" and "20 years" |
| 5 | Owners: Mike and Valerie Single | Public listings | Confirm spelling, and that they want naming |
| 6 | ASE certified | Own site + a NAPA requirement | Confirm current |
| 7 | NAPA AutoCare Center | NAPA directory, facilityId 1326381 | Confirm current |
| 8 | 24 mo / 24,000 mi warranty | NAPA's standard Peace of Mind terms | Confirm the shop honors standard terms |
| 9 | 4.5 from 55 Google reviews | The listing, read 2026-09-01 | Re-read before launch; update `rating` / `review_count` |
| 10 | Google Maps link | A Maps **search** URL, not the profile's own | Replace `maps_listing` with the GBP share link |
| 11 | Geo 38.4094, −121.3558 | Geocoded from the street address | Fine-tune from the listing |
| 12 | Towns served | Neighbouring communities | Confirm the shop wants all ten |
| 13 | **Redirects** | Only `/services`, `/aboutus`, `/contact` confirmed indexed | **Verify against the live site** — Search Console → Indexing → Pages |
| 14 | Reviews | One verbatim quote, no reviewer name | Add real ones to `reviews` in `site.json` |
| 15 | ~~Shop photos~~ | **Done** — full-resolution originals supplied, 1400×875 | Still missing: storefront with the real sign, and the team |

## Only the owner can do these

1. Supply the email, then click the one-time FormSubmit confirmation link.
2. Shoot a real hero clip when convenient. The current one is AI-generated, is
   not this building, and its storefront sign reads `916-000-5277` against the
   real (916) 686-5277. Ten seconds on a phone replaces it with one command.
3. Verify the old page addresses so the 301s are complete.
4. Update the Google Business Profile — categories, all twelve services, photos,
   website link — and make the name/address/phone match this site exactly.
5. Supply the remaining photos: the real storefront with the real sign, and the team.
6. Ask customers for reviews. See `marketing/review-request-templates.md`.
