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
npm run contrast       # hero copy vs the video, frame by frame
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

**In and live.** `public/assets/video/shop.mp4` (1.36 MB) + `shop.webm` (1.48 MB),
7.0 s, silent. It is a push from the forecourt through the roll-up door into the
bay, so the loop point is a scene change rather than a match cut — acceptable,
and unavoidable without ping-ponging it.

The encode starts at **3.0 s**, which is the only cut made: the generation tool
lays a large animated logo watermark over the first ~2.7 seconds, and it is the
single most visible thing in the frame while it is there. Nothing of the shop is
lost — the storefront is fully in view from 3.0 s on.

### The clip is the full 10 seconds, by the owner's decision

The supplied clip is AI-generated and its first ~6 seconds are a storefront
with problems. They were raised, reviewed and the call was made to use the
whole thing anyway. Recording what is on screen so nobody rediscovers it:

- **The sign on the building reads `916-000-5277`.** The shop's real number is
  **(916) 686-5277** — the middle three digits are wrong. It sits behind the
  headline and the hero scrim knocks it well back, but it is there.
- The logo on that sign is maroon rather than the real orange and blue, and
  "SOLUTIONS" under it is garbled. The address line is illegible.
- A **"DIESEL REPAIR"** sign is on the wall. This shop does not claim diesel.
- The building is not 9253 Elk Grove Blvd. The neighbouring "blush salon" sign
  is real — Blush Salon & Spa does share that address.
- A generated logo watermark covers most of the frame for the first ~2.7
  seconds. This is the one thing trimmed: the encode starts at 3.0 s.

Everywhere else on the site the phone number is correct and identical;
`scripts/audit.mjs` enforces that. The number in the video is the one place it
is wrong, and no text on the page repeats it.

**This stays on the confirm-before-launch list.** Ten seconds shot on a phone
at the real shop would replace it outright, cost nothing, and remove the issue:

```bash
npm run video -- ~/real-clip.mov
```

Nothing in the code changes.

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
| Hero copy vs the brightest pixel behind it, every second of the clip (`npm run contrast`) | worst 5.81:1, needs 4.5:1 |
| Audio | stripped (`-an`) |

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
| 2 | **Hero video shows a wrong phone number** | The supplied AI-generated clip; owner chose to ship it as-is | Reshoot 10 s at the real shop and re-run `npm run video`. See above. |
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
2. Reshoot the hero clip when convenient. The current one shows `916-000-5277`
   on the building; the real number is (916) 686-5277. Ten seconds on a phone
   replaces it with one command.
3. Verify the old page addresses so the 301s are complete.
4. Update the Google Business Profile — categories, all twelve services, photos,
   website link — and make the name/address/phone match this site exactly.
5. Supply the remaining photos: the real storefront with the real sign, and the team.
6. Ask customers for reviews. See `marketing/review-request-templates.md`.
