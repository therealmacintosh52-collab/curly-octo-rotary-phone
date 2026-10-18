# DESIGN BRIEF: 916 Dent & Detail (Stage 3, written before any CSS)

Inputs: owner brand (fixed), `research/design-references.md` (hypotheses; no reference site was viewed), `sites/phils-auto-fleet-repair` and `sites/cali-tints` (read directly), the owner's hero frames and card (viewed). Brand is **not up for debate**: Onyx #0B0B0C, Graphite #16171A, Gold #C9A24A, Light Gold #E8CB7A, Ivory #F3EEE3, Steel #8C8F96; Michroma (display) + Inter (body). This brief decides everything around it.

## 1. Layout archetype: "night-studio concierge"

**What it is.** A phone-first, one-column sequence of numbered **plates** (full-width onyx or graphite bands), each carrying one idea, one proof element and one action, in a luxury-showroom register. On desktop the same plates sit on a 12-column grid with a **left index rail** (plate number + label, sticky) and a wide content column. The page reads like a studio walk-through: you arrive, you see the transformation, you learn whether your dent qualifies, you send a photo.

**Why this and not an emergency-trade or catalogue layout.**
- Customers are not in an emergency; they are choosing who to trust with a car. Research says price-led entry, trust-led close (TC-C02), and that "dark premium" is the trade's cliche (KD-design-template): the register needs restraint, not more black.
- The conversion is a **photo**, not a form-first call. The archetype puts the "will my dent qualify and how do I send a photo" explanation inside the flow, as a plate, not behind a "Contact us" link (design-references synthesis 1 to 3).
- No real proof assets exist (no reviews, photos, years, licence). The archetype leans on what is real: process transparency, honest limits, named places, owner-supplied facts. It has no slot that needs a fake stat band, star row or badge wall.
- Owner direction: "luxury automotive studio at night. Dark, glossy, negative space, one bold moment per section."

**What it deliberately is not:** split hero with a form, hero video with a booking card, stat band, three icon cards, angled dividers, star-rating row, alternating light/dark bands.

**Plate anatomy (all templates).** Gold hairline (1px, 40% alpha, draws in once), plate marker, H2 in Michroma, one lead sentence in Inter, one proof element (diagram, list, table or the hero imagery), one action row. Lists render as **rows** (number, name, one line, arrow), not cards.

## 2. Hero concept and performance plan

### 2.1 Concept: "Dent to gloss, in your thumb"

A pinned, scroll-scrubbed vertical panel plays the owner's transformation (dented door, then clean, then beaded gloss) while three copy lines change in sync. It is **progressive enhancement of a fully readable static hero**.

- **Copy (real HTML, in the H1, visible with JS off):** H1 = eyebrow "Mobile paintless dent repair & detailing in Sacramento" + three lines "Dents gone." / "Paint glowing." / "We come to you." Line 3 carries the metallic gradient (#8E6E2E → #E8CB7A → #B8913E), the only gradient headline on the site. Subhead: "Mobile paintless dent repair and detailing across Sacramento. No body shop. No repaint." (owner wording) plus the honest qualifier in the same block: "Most shallow-to-moderate dents with intact paint. We tell you if yours isn't one." Actions: gold **Get a price from a photo**, outline **Call (916) 868-2447**.
- **Honest labelling:** the frames look like a staged or generated scene (dark navy sedan, wet studio floor), not a documented job. Caption under the panel, 12px Steel: "Illustration. Not a customer vehicle." controlled by `HERO_IS_REAL_JOB=false`; the owner flips it only if the footage is a real job and they approve (TO-CONFIRM #4, conflicts C14). No before/after claim is made on the page.
- **Scrub mode (enhanced):** stage is `position: sticky` inside a track of about 320svh (100svh stage + 220svh travel), so no pin-spacer and no layout shift. Scroll progress maps to a frame; lines appear at 0 to 30% ("Dents gone."), 30 to 60% ("Paint glowing."), 60 to 100% ("We come to you." + actions emphasised). Actions are present and tappable the whole time.
- **Static mode (default markup; also no-JS, reduced motion, Save-Data, low-end, failed load, bfcache restore mid-page):** the **final** frame (clean, beaded) with all three lines stacked and fully visible; no pinned track (stage height auto, about 100svh). Showing the dented frame beside "Dents gone." would contradict the copy.
- **Desktop:** the owner supplied no wide video. Panel is a tall rounded rectangle on the right (about 5 of 12 columns, using the 720x1000 crop), copy on the left, over a blurred and darkened `hero-beading` backdrop. Same scrub and static rules.

### 2.2 Performance plan (numbers measured in this stage unless marked estimate)

Source frames exist at `916-dent-detail/public/hero/{m,d}/000-120.webp` (121 frames; mobile 720x1280 about 12.4 MB total, avg 102 KB; desktop 720x1000 about 9.3 MB, avg 78 KB). **Shipping all 121 frames is rejected** (12 MB is the whole performance budget many times over).

| Tier | When | Assets | Cost |
|---|---|---|---|
| 0: LCP image | everyone | `poster-m.avif` 24 KB / `poster-d.avif` 20 KB (frame 0) **or** `static-m.avif` 40 KB / `static-d.avif` 32 KB (final frame) by mode; WebP fallbacks 64 KB / 48 KB / 116 KB / 96 KB | one `<picture>`, explicit `width`/`height` (720x1280, 720x1000), `fetchpriority="high"`, no lazy; media-gated `<link rel=preload as=image>` so the right one is fetched first |
| 1: scrub set | enhanced only, after first scroll or touch intent inside the hero | **31 frames** (every 4th of the 121, indices 0..120), re-encoded at build to 540 px wide: mobile **AVIF q40 about 682 KB total (22 KB avg)**; desktop panel **AVIF q40 about 540 KB (17 KB avg)** (measured). WebP q70 fallback about 1.5 MB / 1.2 MB only for browsers without AVIF | loaded nearest-to-current first, then coarse-to-fine, 4 at a time, never on the critical path; decoded with `createImageBitmap` where available; adjacent frames cross-faded on the canvas so 31 frames read as smooth |
| 2: optional refinement | desktop, fast connection | none by default. Raise to 61 frames only if a real-device test shows visible stepping | n/a |

- **Enhancement JS:** hand-written, no GSAP, no Lenis, about 4 to 6 KB gzip (estimate), loaded with `type=module` after `load` and idle, or on intent. It does one thing: map `scrollY` to a frame on `requestAnimationFrame`, with a passive scroll listener.
- **Gate (decided before first paint by a tiny inline script, then confirmed in the module):** scrub only if `prefers-reduced-motion: no-preference`, `navigator.connection.saveData` is not true, `effectiveType` is not 2g/3g, `deviceMemory` is undefined or greater than 2, `hardwareConcurrency` is undefined or greater than 2, and the scroll position at load is within the hero. Anything else stays in static mode.
- **No render blocking:** critical CSS inline (target 10 KB or less), the rest of CSS 25 KB or less gzip, loaded normally; fonts self-hosted.
- **Fonts:** reuse `916-dent-detail/src/fonts/` (Michroma 400 at 9.7 KB, Inter 400 at 15.1 KB, Inter 600 at 15.5 KB; Basic Latin + Latin-1 + punctuation subset of the @fontsource packages 5.3.0; SIL OFL licence files included). Preload Michroma 400 and Inter 400 only. `font-display: swap` (owner spec) with metric-adjusted fallbacks (`size-adjust`, `ascent-override`) so swap does not shift layout. Michroma ships in one weight; no faux bold.
- **Estimated home first-load transfer** (not measured): HTML 12 to 18 KB gz, CSS 18 to 30 KB, fonts about 25 KB preloaded plus 15 KB, LCP image 24 to 40 KB, `site.js` 5 KB: about 100 to 140 KB before any scrub frames. Lighthouse numbers come from Stage 6; targets are the Blueprint's (Performance 95 or more, LCP under 2.5 s, CLS under 0.1, INP under 200 ms). Prior experience on this asset set (existing Next.js app): LCP was 2.6 s median under simulated mobile, so the static-first and no-library approach is chosen to beat it.
- **Reserved space:** the stage has `aspect-ratio` and `min-height` so there is no CLS from image or canvas; the canvas replaces the poster in place and is `aria-hidden` (the image carries `alt`: "Illustration of a dented car door becoming a clean, water-beaded gloss finish").
- **Accessibility of text over imagery:** measured against the actual frames (p99 pixel luminance by region). Raw frames have a bright wet-floor reflection in the lower 30% (p99 relative luminance about 0.47 to 0.61, which would give Ivory only 1.4 to 1.8:1) but a dark top (about 0.03). Rules: (1) all hero text sits in the top 55% of the stage on an Onyx scrim of at least 85% alpha over the top 35% and 50% over 35 to 55% (computed worst case Ivory 9.6 to 11.7:1); (2) the lower 30% carries an Onyx scrim of at least 90% where anything overlaps; (3) the primary button is opaque Gold with Onyx label (8.20:1) so it never depends on the image; (4) Stage 6 samples the pixels behind each text box at 0, 30, 60 and 100% scroll states and fails the build under 4.5:1 (3:1 for the 26px+ lines).
- **Same imagery rules** apply to the Gloss Shield plate (`beading-640.avif` from the existing app's `public/beading/`, also an illustration unless the owner says otherwise).

## 3. Color and tone

Palette is the owner's six, used as: Onyx page ground, Graphite plates and inputs, Ivory text, Steel secondary text, **Gold = accent only** (primary button, 1px hairlines, kickers, links, focus), Light Gold = hover/focus. No other hues. There is no red: errors are shown with an "Error:" prefix, an icon and a Gold-outlined field (never color alone). The hero imagery is blue-navy; it is kept as supplied (no tint), contained by Onyx scrims and a Gold hairline frame, so the cool image reads as "night studio" against warm gold type.

Gold gradient (#8E6E2E → #E8CB7A → #B8913E): **hero line 3 and plate numerals only**, always at 24px or larger, always with a solid `#C9A24A` fallback color. Gold never fills a large block.

## 4. Contrast table (computed; rerun with `python3 strategy/contrast-check.py`)

WCAG 2.1 relative luminance. AA: 4.5:1 body, 3:1 large text (24px, or 18.66px bold) and UI components.

| Use | Foreground | Background | Ratio | Requirement | Result |
|---|---|---|---|---|---|
| Body text | ivory #F3EEE3 | onyx #0B0B0C | 17.00:1 | AA 4.5 | pass |
| Body text on plates and forms | ivory #F3EEE3 | graphite #16171A | 15.49:1 | AA 4.5 | pass |
| **Secondary text, captions, kickers (Steel), small text** | steel #8C8F96 | onyx #0B0B0C | **6.07:1** | AA 4.5 | pass |
| **Secondary text on graphite (Steel), small text** | steel #8C8F96 | graphite #16171A | **5.53:1** | AA 4.5 | pass |
| Link and kicker text (Gold) | gold #C9A24A | onyx #0B0B0C | 8.20:1 | AA 4.5 | pass |
| Link text on graphite | gold #C9A24A | graphite #16171A | 7.47:1 | AA 4.5 | pass |
| Link hover, focus ring, active nav (Light Gold) | lgold #E8CB7A | onyx #0B0B0C | 12.42:1 | AA 4.5 / UI 3 | pass |
| Light Gold on graphite | lgold #E8CB7A | graphite #16171A | 11.31:1 | AA 4.5 / UI 3 | pass |
| Primary button label | onyx #0B0B0C | gold #C9A24A | 8.20:1 | AA 4.5 | pass |
| Primary button hover label | onyx #0B0B0C | lgold #E8CB7A | 12.42:1 | AA 4.5 | pass |
| Graphite label on gold | graphite #16171A | gold #C9A24A | 7.47:1 | AA 4.5 | pass |
| Outline button text and 1px border | gold #C9A24A | onyx #0B0B0C | 8.20:1 | AA 4.5 / UI 3 | pass |
| Input border | steel #8C8F96 | graphite #16171A | 5.53:1 | UI 3 | pass |
| Gradient darkest stop, large text only (24px min) | #8E6E2E | onyx #0B0B0C | 4.14:1 | Large 3 | pass (fails 4.5, so never below 24px) |
| Gradient middle stop | #B8913E | onyx #0B0B0C | 6.71:1 | Large 3 | pass |
| Gradient lightest stop | #E8CB7A | onyx #0B0B0C | 12.42:1 | Large 3 | pass |
| NOT USED: Ivory on Gold | #F3EEE3 | #C9A24A | 2.07:1 | n/a | forbidden pairing |
| NOT USED: Steel on Ivory (no Ivory surfaces) | #8C8F96 | #F3EEE3 | 2.80:1 | n/a | forbidden pairing |
| NOT USED: Light Gold on Gold | #E8CB7A | #C9A24A | 1.51:1 | n/a | forbidden pairing |
| NOT USED: gradient dark stop for small text | #8E6E2E | graphite #16171A | 3.77:1 | n/a | forbidden |

**Steel #8C8F96 passes AA for small text on both Onyx (6.07) and Graphite (5.53).** It is safe at 12px and up; do not place it on any lighter or imagery surface. Text over photography is governed by the scrim rules in section 2.2 (the only place contrast is measured on pixels, not tokens).

## 5. Type pairing, scale and line length

- **Display: Michroma 400 (extended, geometric).** For H1, H2, plate numerals and the wordmark. Wide and heavy-looking: never for paragraphs, never for buttons or small labels below 18px. All-caps is not forced; sentence case keeps Michroma legible.
- **Body and UI: Inter 400 and 600.** Buttons and labels Inter 600, uppercase labels tracked +0.12em at 12 to 13px.
- Scale (fluid, mobile 390 to desktop 1280; values are `clamp()` endpoints):

| Role | Font | Mobile | Desktop | Line height | Notes |
|---|---|---|---|---|---|
| Hero H1 lines | Michroma | 26 px (min) to 30 px | 56 to 64 px | 1.12 | 358 px usable width at 390: "Paint glowing." (14 characters) fits at 28 px; the eyebrow is 12px Inter caps above, inside the H1 |
| H2 (plate title) | Michroma | 22 px | 36 px | 1.2 | max 22ch |
| H3 | Inter 600 | 18 px | 20 px | 1.35 | |
| Lead | Inter 400 | 18 px | 20 px | 1.55 | max 60ch |
| Body | Inter 400 | 17 px | 17 px | 1.6 | **max 66ch**; never below 16px |
| Kicker / label | Inter 600 caps | 12 px | 13 px | 1.3 | Gold or Steel |
| Caption | Inter 400 | 13 px | 13 px | 1.45 | Steel |
| Plate numeral | Michroma, gradient | 32 px | 56 px | 1 | 24px minimum (gradient rule) |
| Button | Inter 600 caps | 14 px | 14 px | 1 | 48px height, 44px minimum width |

Spacing unit 8px; plate padding 56px top and bottom on mobile (88px desktop); gutters 16px mobile, 24px tablet, grid max 1200px. Tables and lists use Inter with tabular figures.

## 6. Section rhythm (home) and "one bold moment per section"

| Plate | Purpose | Bold moment (one) | Ground | Action |
|---|---|---|---|---|
| Hero | Show the transformation, state the offer | Pinned scrub; line 3 in metallic gold | onyx over imagery | Get a price from a photo; Call |
| 01 How it works | Send a photo, we come to you, drive away fixed (owner's three steps) | Vertical rail of three numerals with a drawn gold line | graphite | Text photos |
| 02 Will it work on my dent? | Honest limits: "Fixable without paint" vs "Not a PDR job" with our own dent cross-section drawings (SVG) | The two-column can / can't drawing | onyx | Send a photo to find out |
| 03 What we do | Six services as rows: plain name, real term in Steel caps, one line, arrow | The row hover state (gold hairline sweep) | graphite | Per-row link |
| 04 Gloss Shield | Coating moment | Water-beading image (owner asset, labelled illustration) full-bleed with scrim | onyx | Ceramic coating page |
| 05 Dealers and fleets | B2B door | One declarative line, no statistic: "Dents on your lot? We come to the lot." | graphite | Call; Text |
| 06 Where we work | Named places in two columns; the four city pages linked | Large place names in Michroma with hairline separators; no map | onyx | Service area |
| 07 Guides | Four question rows | The first guide's answer shown inline | graphite | Guide links |
| Close | Single action | "Send a photo." in Michroma, gold button | onyx | Photo quote; Call |

Inner pages follow: H1, 40 to 60 word answer, action row, then plates (what it is, what affects it, what we can't do, FAQ in native `<details>`, nearby links), end action. Plate numbering appears on the home page only; inner pages use a Gold kicker instead, so the metallic numeral stays special.

## 7. Trust devices (real only)

Used: (1) the honest "what PDR can't fix" plate and guide; (2) process transparency: the 3-step flow, the photo shot list with our own drawings, what we'll tell you after seeing photos; (3) owner-supplied facts exactly as given: mobile, two owner-technicians and a crew, retail and B2B, no body shop and no repaint for dent removal; (4) real phone and Instagram; (5) named places and the four city pages with sourced local facts; (6) price-drivers guide that admits a price needs photos; (7) accessible, fast, no third-party trackers; (8) once the owner approves it, a plain statement that every customer is asked for a review with no gating (about page).

**Reserved slots, not rendered until real:** real job photos (shot list), Google reviews with attribution and a link, licence or registration number, certificate of insurance line, warranty terms, named technicians. **Never:** stars, rating or count rows, badge walls, "years", "licensed and insured", stat band, "most popular".

## 8. Motion language and where it stops

- **Hero scrub only** carries real motion (section 2). It stops when the stage unpins.
- Everywhere else: (a) a 1px Gold hairline under each plate title draws once (CSS `animation-timeline: view()` inside `@supports` and `@media (prefers-reduced-motion: no-preference)`; unsupported or reduced = hairline simply present); (b) button hover and press (160ms color and 1px translate); (c) service-row hover hairline sweep; (d) `<details>` open without height animation.
- Rules (Blueprint "motion safety"): no content is hidden by CSS waiting for JS; no `opacity: 0` initial states outside `html.scrub` hero lines, which are scoped to the enhanced mode only and fall back visible; no IntersectionObserver reveals; no count-up numbers (there are no stats); no parallax, no cursor effects, no autoplay video, no sound.
- `prefers-reduced-motion: reduce` removes the scrub, the hairline draw and transitions.

## 9. Mobile first: the 390 px layout

Design the 390 layout first; desktop is the same plates re-gridded.

```
390 x 844 (svh), safe areas respected
+--------------------------------------+
| [D] 916 DENT & DETAIL      [call] [≡]|  56px header: D-mark + live Michroma text; Call icon 44px
+--------------------------------------+
| MOBILE PAINTLESS DENT REPAIR &       |  eyebrow 12px Inter caps, Steel  (inside the H1)
| DETAILING IN SACRAMENTO              |
|                                      |
| Dents gone.                          |  Michroma 28px, Ivory     (scrim 85% Onyx behind)
| Paint glowing.                       |  Michroma 28px, Ivory
| We come to you.                      |  Michroma 28px, gold gradient
|                                      |
| No body shop. No repaint. Most       |  Inter 17px
| shallow dents with intact paint.     |
| [ Get a price from a photo ]         |  gold button, 48px, full width     <- thumb zone starts
| [ Call (916) 868-2447      ]         |  outline button, 48px
|                                      |
|   ~~~~ car frame (scrub canvas) ~~~~ |  full-bleed, 720x1280 asset, behind the above
|   Illustration. Not a customer       |  caption 12px Steel on 90% scrim
|   vehicle.                           |
+--------------------------------------+
| [ Call ] [ Text ] [ Get price ]      |  sticky bar, graphite, 56px + safe-area; Get price is gold
+--------------------------------------+
```

**One-thumb reach:** the three primary actions are in the lower half (hero buttons) and the sticky bar (bottom 56px), which is the natural thumb zone on a 6-inch phone; the header Call icon is the only top-corner action and is duplicated in the bar. No action requires a two-handed stretch, hover or a precise tiny target; all are 44px or more, 8px apart. The sticky bar never covers form fields (it hides when the on-screen keyboard is up) and never covers the footer (bottom padding equals bar height).

Plates below the hero (390): single column, 16px gutters, 56px plate padding; service rows 64px tall full-width tap targets; FAQ summaries 48px; tables become stacked definition lists under 480px; the form is one column with 48px fields and visible labels.

## 10. Anti-template test (read from `sites/`, recorded concretely)

Both other sites were read directly from files (Verified). 916 is the only sibling that is not a light/indigo or a lime/black system, and the only one that opens on motion tied to the content.

| Axis | Phil's Auto & Fleet (Lodi; `public/assets/css/site.css`, `index.html`, `build.py`) | Cali Tints (Sacramento; `src/styles/*.css`, `VideoHero.astro`, `index.astro`) | **916 Dent & Detail (this site)** |
|---|---|---|---|
| Palette | Light: paper `#ffffff` and `#f6f6fb`, ink `#0a0a1f`, indigo accent `#3b2ce8` (`#2418cc` from logo), warm star `#f5a623` | Dark: ink `#0b0f0b` and `#10160f`, lime `#9be86a` (vivid `#80d850`), text `#eef2ea` | Dark, warm neutral: onyx `#0B0B0C`, graphite `#16171A`, gold `#C9A24A`, ivory `#F3EEE3`, steel `#8C8F96`. No lime, no indigo, no stars. Only dark sibling with a different hue family |
| Type | System sans stack (`-apple-system, Segoe UI, Roboto…`), Georgia only for a quote mark; 17px body | Inter body plus Space Grotesk display, self-hosted, `font-display: optional` | **Michroma** (extended display) plus Inter, `font-display: swap`. Michroma appears in neither sibling. Display type is wider and used far more sparingly |
| Hero | Split: text left, quote form card right, then a stat band; light | Full-bleed video or poster with scrim and a booking card over the clip | Pinned scroll-scrub frame sequence (dent to gloss) with three synced copy lines; no form in the hero; no card over the media; static final frame when motion is off |
| Layout structure | Alternating light and dark bands (`bg-alt`, `bg-dark`), angle dividers, service cards, stat band, rating line, "Listed on" strip, Spanish mirror (`/es/`), 25 pages | Astro components: `AngleDivider`, `StatBand`, `Glance`, `Difference`, `BookingCalendar`, `QuoteForm`, `Assistant`, `CtaBand`, `Stars`, cards in `g3` grids | Numbered **plates** with a sticky left index rail on desktop; services as **rows** not cards; no stat band, no angle dividers, no star or rating row, no listed-on strip, no assistant widget, no calendar, no mirror |
| H1 formula | "Honest auto, diesel & fleet repair in Lodi, California" = adjective + service + "in" + town + state | "Window tinting, wraps & ceramic coating in Sacramento, California" = services + "in" + town + state | Home: eyebrow plus the owner's three statements; inner pages are outcome-first ("Paintless dent repair that comes to you, no paint and no body shop", "Get a price from a photo", "Dent repair on your lot…"). **No "[service] in [town], California" formula, no state suffix** |
| `<title>` shape | "Lodi Auto Repair & Fleet Service \| Phil's Auto & Fleet" | "Window Tinting in Sacramento, CA \| Cali Tints" | "Paintless Dent Repair Sacramento \| 916 Dent & Detail". Honest note: the "Service City \| Brand" pattern is the search convention and cannot differ much; it drops "in" and the state, and the H1 carries the difference |
| Primary conversion | Free-quote form near the top; sticky call bar (`callbar`) | Booking card, calendar, quote form, assistant | Photo-quote path (text photos, call, optional form) and a three-action sticky bar. A sticky bar is shared functionality, not shared design: graphite bar, gold primary only, labels not icons |
| Proof devices | Star rating, "Rated 4.4 out of 5 across 83 Google reviews", listed-on strip | Stars, review sources | None invented; honest-limits plate, process, shot list, price-drivers guide |
| Imagery | Photo slots in "Inside the shop" | Photo and video | Own SVG diagrams plus the owner's hero frames, labelled as illustration |
| Build | Python static generator | Astro | Python static generator (engineering pattern reused; design and copy not borrowed) |

Result: differs on palette (only gold-on-warm-onyx), type pairing (Michroma unused elsewhere), hero concept (scroll-scrub transformation, no media card, no form), layout structure (plates and rows, no band alternation, no stat band) and H1 formula. Shared by necessity: static build, a sticky mobile action bar, standard title shape. If a third site arrives in `sites/`, rerun this table first.

## 11. Image and graphics plan (no stock, no copied images)

- Owner assets: hero frames (illustration, labelled), `hero-beading` image, logo (gold 3D D in a roof/shield mark), card art as visual reference only (the card's hex texture is the one device this site does not use: it is on the trade-cliche list).
- Made by us (SVG): dent cross-section drawings (shallow round dent, sharp crease, stretched metal), photo shot-list poses (four small diagrams), plate numerals, sticky-bar icons, favicon variants.
- Photo slots: none rendered. Each empty slot is listed in `PHOTO-SHOTLIST.md` (Stage 5) and the page works without it.
- Social/OG: per-key-page share image generated from a template (onyx, gold hairline, Michroma title, D-mark), no baked claims.

## 12. Build handoff checklist for Stage 4

1. Tokens as CSS custom properties from section 3; no color outside the six plus alpha.
2. Fonts per section 2.2; verify the glyphs used ("·", "&", curly quotes) exist in the subset (U+00B7 is inside the Latin-1 range).
3. Hero per 2.1 and 2.2; static mode is the default markup; run the Stage 6 pixel-contrast sampler.
4. Sticky bar and header per sections 9 and CONVERSION-PLAN; test with the keyboard open and at 200% zoom.
5. Run `strategy/contrast-check.py` in CI; it fails on any required pair under its threshold.
6. Rerun the anti-template table against the then-current `sites/` folders.
