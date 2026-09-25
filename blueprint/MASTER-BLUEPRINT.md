# Master Blueprint: a professional, ranking, video-hero business website for any niche

The reference build is `sites/phils-auto-v2/` (Phil's Auto & Fleet Repair). Every new site is
that codebase with a different **data file, brand tokens, video and copy**. Nothing structural
changes between niches. This document is the recipe; `intake.md` is the form you fill for each
niche; `new-site-prompt.md` is the prompt you paste into Claude Code to build it.

Order of work, always the same:

1. Intake (fill `intake.md`)  →  2. Data file  →  3. Brand tokens + fonts  →  4. Video slot
(placeholder until the clip arrives)  →  5. Pages  →  6. Perf pass  →  7. SEO + AI-search pass
→  8. Marketing kit  →  9. Launch checklist  →  10. Swap the real video in, republish.

---

## 1. What makes the site "professional" (the non-negotiables)

Every site built from this blueprint ships with all of these. No exceptions per niche.

| Area | Standard |
|---|---|
| First impression | Full-screen muted autoplay video hero, transparent nav with gradient band, three CTAs visible before anything else (primary action, get a quote/booking, directions or secondary) |
| Trust | Real rating and review count (verified, never invented), four quoted real reviews with source, physical address, hours, a named owner or team |
| Conversion | Phone number in header, hero, sticky mobile call bar, footer. Quote/booking form on the home page directly under the hero on phones and on every service page |
| Speed | Lighthouse mobile ≥ 90 performance, 100 accessibility/best-practices/SEO, CLS 0. Poster image is the LCP, video source attaches after `load` |
| Search | One keyword family per URL, unique title/meta/H1, JSON-LD (LocalBusiness subtype, Service, FAQPage, Article, BreadcrumbList, AggregateRating), sitemap, 301 map from any old URLs, per-page OG image |
| AI answer engines | `robots.txt` allowlist for AI crawlers, `llms.txt`, answer-first "At a glance" / "Short answer" blocks, IndexNow push to Bing, entity `sameAs` links |
| Accessibility | Semantic headings in order, skip link, focus styles, alt text, `aria-label`s on icon buttons, reduced-motion respected everywhere except the hero (owner's choice) |
| Robustness | Autoplay fallback (poster + tap-to-play cue on iPhone Low Power Mode), form honeypots, CSP headers, cache headers, custom 404, thank-you page excluded from index |
| Bilingual (optional) | `/es/` or other language home with `hreflang`; on by default for any consumer trade in California |
| Maintainability | All business facts in one JSON file. Adding a service or a guide is a data change plus `npm run og` |

---

## 2. Stack (fixed; do not re-decide per project)

- **Astro 5** static output, `trailingSlash: 'always'`, `build.assets: 'static'`, `inlineStylesheets: 'always'`.
- **Plain CSS** with tokens (`legacy.css` components + `global.css` hero/motion). No Tailwind (its prelude breaks in some iOS in-app browsers).
- **Fonts:** two self-hosted Latin woff2 subsets, `font-display: optional` with metric fallbacks, two files preloaded.
- **Motion:** GSAP + ScrollTrigger, Lenis smooth scroll, split-text reveals, magnetic buttons, custom cursor (desktop only).
- **3D (optional, desktop only):** React island with react-three-fiber, mounted only on ≥ 881 px, GPU tier ≥ 2, after `load` + idle, DPR ≤ 1.5, render loop paused off-screen. Phones never get it.
- **Forms:** FormSubmit endpoint (or Netlify Forms once on Netlify) with two honeypots and a thank-you redirect.
- **Hosting:** Netlify (base directory = the site folder, build `npm run build`, publish `dist`). `_headers`, `_redirects`, `netlify.toml` in `public/`.
- **Tooling:** `scripts/og-images.mjs` (Playwright renders one OG JPEG per page), `scripts/indexnow.mjs`, `scripts/preview-relative.mjs` (relative-URL copy for sub-path previews), Lighthouse for the perf numbers.

---

## 3. The data file (everything niche-specific lives here)

`src/data/site.json`. Fill it from `intake.md`. Field by field:

```
site:        name, short, base_url, phone_display, phone_link (+1…), email,
             street, city, region, region_long, zip, lat, lng,
             hours_human, hours_rows[[day, hours]], hours_schema[{days[], opens, closes}],
             rating, review_count (VERIFIED from the live Google listing),
             areas[] (10 towns, nearest first), founded_note, logo, favicon,
             warranty_text, promise (the one-sentence positioning line)
nav:         [[label, path]] – 6 items max
services:    12 objects: slug, nav, icon, title, h1, meta, blurb, intro[2], includes[8],
             signs[6], faqs[3 × [q, a]]
guides:      4–6 advice posts: slug, nav, title, meta, blurb, icon,
             sections[[heading, "p"|"ul", items[]]], takeaway (the Short answer)
reviews:     4 real quotes: quote, name, source, url
home_faqs:   6 × [q, a] (location, hours, pricing, what you work on, booking, warranty)
old_url_map: {old path: new path} for the 301s (empty on a brand-new domain)
profiles:    sameAs URLs – Google Maps, Yelp, Facebook, Nextdoor, industry directories
maps_listing, maps_directions, maps_embed, form_endpoint, icons{}
```

**Schema type by niche** (set once in `src/lib/seo.ts`, `localBusiness()`):

| Niche | `@type` |
|---|---|
| Auto / diesel / fleet repair | `AutoRepair` |
| Plumber, electrician, HVAC, roofer, painter, landscaper | `Plumber`, `Electrician`, `HVACBusiness`, `RoofingContractor`, `HousePainter`, `LandscapingBusiness` (fallback `HomeAndConstructionBusiness`) |
| Dentist, chiropractor, physio, med spa | `Dentist`, `Physician`/`MedicalClinic`, `HealthAndBeautyBusiness` |
| Law firm, accountant, insurance | `LegalService`, `AccountingService`, `InsuranceAgency` |
| Restaurant, café, bar | `Restaurant`, `CafeOrCoffeeShop`, `BarOrPub` (add `servesCuisine`, `menu`) |
| Gym, yoga, martial arts | `ExerciseGym`, `SportsActivityLocation` |
| Salon, barber, tattoo | `HairSalon`, `BeautySalon`, `TattooParlor` |
| Real estate, property management | `RealEstateAgent` |
| Cleaning, moving, pest control | `HomeAndConstructionBusiness` or `MovingCompany`, `PestControl` isn't a type → `LocalBusiness` with `knowsAbout` |
| Anything else | `LocalBusiness` with `knowsAbout[]` and `hasOfferCatalog` |

Rule: the twelve "services" are whatever the business sells, one page each, each with its own
keyword family. A restaurant's "services" are menu categories and occasions (catering, private
events). A dentist's are procedures. A law firm's are practice areas.

---

## 4. Brand tokens (the only CSS you change per niche)

In `src/styles/legacy.css` `:root` and `global.css`:

```
--accent, --accent-dk, --accent-lt, --accent-soft   sample from the logo; one saturated colour only
--paper, --paper-2, --paper-3, --line                 page backgrounds; warm for food/wellness, cool for trades/tech
--text, --slate, --slate-light                        keep near-black; tint toward the accent
--grad-dark                                           the dark hero/CTA gradient; built from the accent's darkest shade
--font, --font-display                                two fonts, see the table
--radius                                              16px default; 6–8px for law/finance, 20–24px for wellness/food
```

Font pairings that read as professional (display / text):

| Feel | Display | Text |
|---|---|---|
| Industrial, trades, auto, logistics | Space Grotesk | Inter |
| Medical, dental, clinical | Manrope | Inter |
| Law, finance, consulting | Fraunces or Playfair Display | Source Sans 3 |
| Food, hospitality, boutique | Fraunces or DM Serif Display | DM Sans |
| Fitness, sport | Bebas Neue or Archivo Black | Archivo |
| Wellness, beauty, spa | Cormorant Garamond | Nunito Sans |
| Tech, SaaS, agency | Sora or Geist | Geist or Inter |

Self-host as woff2 Latin subsets in `public/fonts/`; never load from Google at runtime.

Colour by niche (defaults, override with the logo): trades = deep blue or safety orange
accent; medical = teal; law = navy + gold; food = terracotta or forest; fitness = red or acid
green on black; wellness = sage or sand; tech = electric blue or violet.

---

## 5. The video hero (the signature; waits for your clip)

**Until the clip arrives**, the hero is built and shipped with a placeholder: a still poster
frame (a photo of the business front, or a dark gradient with the logo) and the exact same
markup, CSS and JS. Swapping in the real video is a file replacement, no code change.

**Clip spec (give this to whoever shoots it):**

| Item | Value |
|---|---|
| Orientation | Landscape 16:9. Portrait clips get cropped to a strip on desktop |
| Resolution | 1920×1080 source; ship at 1280×720 |
| Length | 6–12 s, loops seamlessly (end frame near the start frame) |
| Content | Slow, steady, wide. One subject. The business's sign or storefront visible somewhere in the frame. No text, no faces close up, no fast pans |
| Audio | None (stripped in encode) |
| Encode | `ffmpeg -i in.mp4 -map 0:v:0 -an -c:v libx264 -crf 25 -preset slow -movflags +faststart -vf scale=1280:-2 shop.mp4` |
| Size | ≤ 3 MB |
| Poster | First frame → JPEG (q4), WebP (q78), AVIF (crf 34, `-still-picture 1`) |
| Framing rule | Desktop hero is `min(100svh, 56.25vw)` so the whole 16:9 frame shows; mobile band is `min(80vw, 60svh)` with `object-position` set to where the sign is |

**Behaviour (already built, keep it):** `muted` set in JS, `play()` retried on canplay /
pageshow / visibility / first gesture; on failure the poster and a tap-to-play pill show;
video `<source>` attached after `load`; hero text and CTAs are in the DOM from first paint.

**Storyboard slot (desktop scroll story, optional per niche):** 4 beats over a 320 vh track.
Beat copy per niche pattern: (0) who you are + the promise, (1) the proof, (2) the range of
work, (3) the ask. Skip the 3D parts unless the niche has physical objects worth modelling.

---

## 6. Page architecture (identical for every niche)

```
/                       home: video hero → stat band → quote form → services grid → why us →
                        reviews → service areas strip → FAQ → CTA band
/services/              index of the 12
/services/[slug]/       At a glance → intro → what's included → signs it's time → local
                        paragraph → quote form + shop panel → FAQ → related → CTA
/advice/                index of guides
/advice/[slug]/         Short answer → on-this-page → sections → takeaway panel → related
/about/                 story, team, values, photos, hours, map
/reviews/               rating, four quotes, "leave a review" button, review schema
/service-areas/         one paragraph per town, map
/contact/               form, phone, address, hours, map embed, directions
/es/ (optional)         translated home
/privacy/ /thank-you/ /404/
```

Renames per niche are copy only: "services" → "menu" / "treatments" / "practice areas" in
labels, never in the folder name (the URL slug can change in `nav` if the keyword map says so).

---

## 7. Copy rules (what makes it sound like a real business, not a template)

- Headline formula: `[Honest/Expert/Same-day] [category] in [City], [State]` + an `<em>` on the place.
- Promise line, one sentence, on the home hero and the about page. Phil's: "Diagnosis first. Quote before work. No upsells." Every niche has one: dentist "You'll know the cost before you're in the chair." Plumber "Upfront price, same day, no weekend surcharge."
- Every service page opens with the **At a glance** block: who, where, hours, what you work on, how pricing works, how to book. Written the way someone asks an assistant the question.
- Every guide opens with the **Short answer** (the takeaway), then the reasoning.
- Numbers over adjectives: intervals, prices where legal, timelines, counts.
- FAQs are real questions from the phone, answered in two sentences with the phone number.
- Words to avoid: cheap, deal, best in town, "we treat you like family", "passionate".
- Never invent a rating, a review, a year founded, a certification or a warranty. Blank beats fake.

---

## 8. SEO + AI-search pass (run for every site, in this order)

1. Keyword map: one family per URL in `seo/keyword-map.md`, with the cannibalization notes (home vs. the main service page).
2. Titles ≤ 60 chars `[Service] in [City], [ST] | [Brand]`; metas ≤ 155 with the phone number.
3. JSON-LD: entity on every page via `@id`, Service + FAQPage on services, Article on guides, AggregateRating on home and reviews, BreadcrumbList everywhere.
4. `robots.txt` with the AI crawler allowlist; `llms.txt`; IndexNow key + `npm run indexnow`.
5. `_redirects` 301 map from every old URL; `_headers` CSP + immutable cache for `/static/*`.
6. OG image per page (`npm run og`), sitemap excludes thank-you/privacy/404.
7. Audit: no broken internal refs, heading order, one H1, alt text, Lighthouse ≥ 90/100/100/100 on mobile.
8. Owner side: Search Console + Bing Webmaster Tools verified, sitemap submitted, GBP filled (categories, services, photos, appointment link), NAP identical on every listing, Apple Business Connect + Bing Places claimed.

---

## 9. Marketing kit (generated per niche from `marketing/plan.md`)

Same ten sections every time: positioning, AI answer engines, local SEO, reviews engine,
12-month content calendar (from the keyword map), social cadence, B2B/referral outreach with an
email template, paid structure with negatives (no budget numbers), measurement, 30/60/90.
Plus `review-request-templates.md` and a review QR code (SVG + PNG). Niche changes the B2B
section: fleets for auto, property managers for trades, employers for dental, wedding
planners for restaurants, physios/coaches for gyms.

---

## 10. QA before anyone sees it

- Every phone number dials, every button goes somewhere, the form submits and lands in the inbox (FormSubmit's one-time confirmation clicked).
- Screenshots at 1440×900, 1920×1080, 390×844 (iPhone), plus the nav open on mobile.
- Hero: plays automatically on desktop Chrome/Safari/Firefox and iPhone Safari; shows poster + cue in Low Power Mode; sign visible on both desktop and the mobile band.
- Lighthouse mobile on home, one service, one guide, contact. Record the numbers in `perf/lighthouse.md`.
- Preview link for the owner built with `scripts/preview-relative.mjs` (sub-path safe).

---

## 11. Timeline per new site

| Day | Work |
|---|---|
| 0 | Intake filled, logo + 10 photos + any old-site URLs received; video brief sent to the owner |
| 1 | Data file, tokens, fonts, placeholder hero, home + services built |
| 2 | Guides, about, reviews, areas, contact, 404/thank-you; OG images; audit |
| 3 | Perf pass + Lighthouse, SEO/AI pass, marketing kit, launch checklist, preview link |
| when clip arrives | Encode, posters, swap files, framing check on desktop + phone, republish |
| launch | Netlify, domain, Search Console, Bing, IndexNow, GBP, citations |

---

## 12. How to start a new site (the actual commands)

```bash
cp -r sites/phils-auto-v2 sites/<new-slug>
cd sites/<new-slug>
rm -rf node_modules dist dist-preview public/assets/og/*
# 1. fill src/data/site.json from blueprint/intake.md
# 2. set the @type in src/lib/seo.ts localBusiness()
# 3. tokens in src/styles/legacy.css :root; fonts in public/fonts + global.css @font-face
# 4. logo.png, favicon.svg, poster images in public/assets/img; video in public/assets/video
# 5. rewrite src/data/guides-v2.ts (or clear it) and the /es/ page (or delete it)
npm install && npm run og && npm run build
node scripts/preview-relative.mjs   # sub-path preview copy
```

Or paste `blueprint/new-site-prompt.md` into Claude Code with the filled intake and let it
do steps 1–5, the audits and the marketing kit.
