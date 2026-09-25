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

Built and shipped now; the clip is a file swap with no code change.

```bash
npm run video -- ~/the-raw-clip.mov
# then set hasVideo={true} on <VideoHero> in src/pages/index.astro
# and focus="…" to wherever the sign sits in frame
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

**Until the clip arrives** the poster is a flat dark texture with no logo and no
words on it, and the mobile media band collapses (`.hero-v--noclip`) so the
headline and the call button are not pushed down by empty space. Setting
`hasVideo={true}` restores the full band automatically.

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
| 2 | **Hero video** | Owner is supplying | `npm run video`, flip `hasVideo` |
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
| 15 | Shop photos | Google-listing thumbnails, ~200 px originals | Get the full-size files off the phone that took them |

## Only the owner can do these

1. Supply the email, then click the one-time FormSubmit confirmation link.
2. Supply the hero clip.
3. Verify the old page addresses so the 301s are complete.
4. Update the Google Business Profile — categories, all twelve services, photos,
   website link — and make the name/address/phone match this site exactly.
5. Supply full-resolution photos: storefront with the sign, the team, work in progress.
6. Ask customers for reviews. See `marketing/review-request-templates.md`.
