# Design references: 916 Dent & Detail (Stage 1, part 6)

Retrieved 2026-10-18.

## Evidence limits (read first)

- **WebFetch was blocked** (DNS errors on every domain; direct curl got proxy 403). **No reference site was loaded or viewed.** Everything below about third-party sites comes from (a) search-result summaries and (b) general background knowledge of the sites. Items marked **[search]** were backed by a search snippet; items marked **[background]** are from general knowledge and are **Unverified** until someone eyeballs the live site. The Stage 3 design brief should treat this file as a hypothesis set, not an observation log.
- Nothing here is to be copied. Layouts are described as patterns only.
- The two repo sites (phils-auto-fleet-repair, cali-tints) were read directly from local files and are Verified for what they contain.

## 1. Reference sites

### 1. Dent Wizard (dentwizard.com): national PDR and dealer-recon leader
- **What converts [search]:** dealership program "Frontline Fast" with a stated outcome (their claim: recon time cut from 7-11 days to under 5; own marketing, unverified); a "who we serve: dealerships" page; phone 1-800-DENT-WIZ plus a contact form; FAQ addressing same-day vs hail multi-day timing.
- **Archetype [background]:** corporate service-catalogue site, red/white brand, segmented by audience (consumer, dealer, insurer).
- **Hero concept [background]:** stock-style vehicle imagery with service CTA.
- **Trust devices [search/background]:** scale, history page (programs launched 2011), national footprint, catastrophe response team for hail.
- **CTA pattern:** phone and "request service" form.
- **Motion:** minimal [background].
- **Weaknesses:** impersonal, shop-location pages mixed with mobile, no visible photo-quote step in what was surfaced. Good model for the B2B page structure only (audience split, outcome-led headline), not for atmosphere.

### 2. Primetech PDR (Sacramento): closest local specialist
- **What converts [search]:** narrow specialism (PDR for cars, motorcycles, trailers/Airstreams), on-site service at home or workplace, insurance-claim help, hail work in Davis/Woodland; listing shows 5.0 Google rating, 53 reviews (via Lantern directory, unverified).
- **Archetype, hero, motion:** own site not seen. A Dribbble shot titled "Paintless Dent Removal Sacramento | Hail Repair Davis | Woodland" suggests a designed site exists [search; not confirmed].
- **Trust devices:** review count, specialism, claim help.
- **Weaknesses (what the search shows):** the surfaced presence is directory-led; no evidence of photo-quote funnel. Treat as a keyword and offer benchmark, not a design model.

### 3. The Dent Tent (Sacramento): local PDR with strong reviews
- **What converts [search]:** quotes by call or text, "same day" and "30 minutes to 1 hour" language, 15+ years claim (their claim), 5.0 rating with 121 reviews per Lantern listing (unverified).
- **Weaknesses:** text-quote exists, but no photo-quote page surfaced. Benchmark for conversion promise wording ("often same day"), which 916 must only echo if the owner confirms its own turnaround.

### 4. Coastal Detail LLC (Sacramento region): mobile paint correction and ceramic
- **What converts [search]:** "Premier Mobile Autospa, Paint Correction & Ceramic Coating Specialists", multiple packages or a la carte, appointment-only, dealer and private clientele, named service area (Folsom, Roseville, Carmichael, Sacramento, Granite Bay); 15 years (their claim), 8 five-star reviews (Google listing).
- **Weaknesses:** small review base, jargon-heavy ("paint correction"), no evidence of photo-led quoting. Shows the plain-language gap 916 can fill ("Swirl & Scratch Erase", "Gloss Shield").

### 5. Gtechniq (gtechniq.com / .co.uk): premium coating brand with accredited-installer network
- **What converts [search]:** exclusivity mechanics. Accredited installers get protected territory (no other accredited detailer within 30 minutes), minimum experience requirements (2 years running a detailing business, 3 years detailing), access to professional-only products. A trust model based on credentials, not adjectives.
- **Archetype [background]:** product-science brand, clean/technical, installer finder.
- **Hero / motion [background]:** macro product and water-beading imagery; restrained motion.
- **Weakness for a local operator:** B2C proof is product-centred. Lesson for 916: show process and standards (steps, products used once the owner confirms them), and only claim certifications if the owner holds them.

### 6. Ceramic Pro (ceramicpro.com) and certified-installer studios
- **What converts [search]:** the "Ceramic Pro Elite / Master Installer" ladder is used by studios as a trust badge (Luxury Road Detail Studio, Detail and Dash, Executive Paint Protection in the results). Warranty offers appear in studio copy. The search tool itself warned that titles like "Elite" or "Master" vary and may be marketing copy, so verify any certification before using the idea.
- **Archetype [background]:** dark, high-contrast studio sites with big car photography, package tiers (coating levels), warranty, installer locator.
- **Weakness:** badge-heavy, stock-heavy, generic "protect your investment" copy.

### 7. Detailed Car Care (Framer template) and other dark-detailing templates: category visual baseline
- **What converts [search]:** free Framer template described as "dark, editorial, aimed at premium studios", deep black backgrounds, service tiers, quote page. Zarla's roundup (also surfaced) says strongest detailing sites use dark high-contrast themes, show proof (reviews, brands, results), and give transparent pricing instead of "call for a quote". Reflections Perfection (Squarespace case study) argues dark themes signal exclusivity.
- **Use for 916:** this shows that "dark + premium" is already the trade template cliché. Differentiation must come from restraint, type and photo-led proof, not from black alone.

### 8. Rolls-Royce / Aston Martin / Porsche (adjacent luxury automotive, atmosphere only)
- **[search, via third-party reverse-engineered design specs, treat as Unverified]:** Rolls-Royce described as near-black cinematic photography with white type, no background colour block, no CTA button in the hero fold. Aston Martin described as tracked uppercase display type plus a separate sans for body, photography as the page floor, little chromatic load. Porsche described as one typeface family, restrained type weights, and leaning light rather than dark. The sources themselves flag some specs as AI-generated.
- **Atmosphere lessons [background]:** negative space, one image per screen, slow reveals, tracked small-caps labels, very few colours. For 916 gold (#C9A24A) on onyx (#0B0B0C) already echoes this register.
- **Caution:** those brands have no hero CTA pressure. A local service site must keep a visible action (call, text, photo quote) in the first viewport.

## 2. Existing sites in this repo (for the anti-template test; read locally, Verified)

| | phils-auto-fleet-repair (Lodi) | cali-tints (Sacramento) | 916 Dent & Detail (planned) |
|---|---|---|---|
| Palette | Light paper `#ffffff`/`#f6f6fb`, deep ink navy `#0a0a1f`, indigo accent `#3b2ce8` (tokens in public/assets/css/site.css) | Dark green-black ink `#0b0f0b`/`#10160f`, lime-green accent `#9be86a`, text `#eef2ea` (src/styles/global.css) | Onyx `#0B0B0C`, graphite `#16171A`, gold `#C9A24A`, light gold `#E8CB7A`, ivory `#F3EEE3`, steel `#8C8F96` (owner brief) |
| Type | System/`var(--font)` stack, Georgia in places (Likely; stack not fully inspected) | Inter body + Space Grotesk display, self-hosted | Michroma display + Inter body (owner brief) |
| Hero concept | Split text + hero grid, followed by a stat band; H1 "Honest auto, diesel & fleet repair in Lodi, California" (index.html) | Full-bleed video/poster hero with scrim, eyebrow "Fulton Avenue · Sacramento, California", H1 "Window tinting, wraps & ceramic coating in Sacramento, California", booking card over the clip (VideoHero.astro) | Pinned scroll-scrubbed vertical frame sequence (dent to beaded gloss) with synced headline "Dents gone. Paint glowing. We come to you." (owner spec) |
| Layout structure | Python-built static site, 25 pages, alternating light/dark bands (`bg-alt`, `bg-dark`), stat band | Astro, components: AngleDivider, StatBand, Difference, Glance, BookingCalendar, QuoteForm, Assistant, CtaBand | To define in Stage 3 |
| Notable shared patterns to avoid repeating | Stat band right under hero; same H1 formula "[service] in [Town], California" | Same H1 formula; video-hero-with-card; angled dividers; stat band | Avoid the "[service] in [Town], California" H1 formula and stat band; lead with the dent-to-gloss sequence and photo-quote step |

Difference check: 916 is the only gold-on-black palette; cali-tints is the only other dark theme and uses lime-green with Space Grotesk; Phil's is light/indigo. Michroma is unused by either. Hero concept (scroll-scrub transformation) differs from both.

## 3. Synthesis: what a luxury, phone-first, photo-quote-led mobile service site should do

1. **Make the photo quote the primary action, not "Contact us".** Competitor evidence shows call/text quotes only. A big "Get a price from a photo" action (SMS/MMS or upload) reachable by thumb from a sticky bottom bar on 390px is a genuine trade differentiator. State the estimate caveat honestly.
2. **Answer the three buyer fears in the first two screens:** "Will it damage my paint?", "Can you fix this dent (is it PDR-able)?", "What will it cost?" The trade's top questions (cost, time, limits, insurance, PDR vs body shop) came straight out of the SERP themes.
3. **Be honest about limits.** A short "what PDR can't fix" block builds more trust than universal claims, and matches how CARSTAR and others describe it.
4. **Plain language first, jargon second.** Competitors use "paint correction", "PDR", "decon". Lead with the owner's names (Dent Removal, Swirl & Scratch Erase, Gloss Shield) and keep the real terms in H2s, alt text, schema and FAQ.
5. **Luxury through restraint:** one idea per screen, large photography, tracked small-caps labels, gold only for actions and hairlines (owner rule). Michroma is wide and heavy: use it sparingly for headlines and numerals, never for paragraphs or buttons at small sizes.
6. **Proof must be real or absent.** No supplied photos, reviews, years, licence or insurance exist. Use placeholders flagged in PHOTO-SHOTLIST, process transparency (steps, what happens when you arrive, what you need to provide: water, power, shade), and a Google-review link later. No fake before/afters.
7. **B2B gets its own door.** Dent Wizard shows the dealer pattern: outcome headline (time saved), "who we serve", simple intake. 916's version: per-panel wholesale pricing on request, same-day on-lot, COI on request (only if the owner has a COI; log in TO-CONFIRM), one-page intake.
8. **Mobile-first motion:** the scroll-scrub hero is high-risk for LCP and low-end devices. Keep frame 0 as a real `<img>`, copy as real HTML, and a static fallback for reduced motion (owner spec already requires this). Motion stops after the hero; no parallax in body sections.
9. **Local credibility without doorways:** name the 14 cities only where real content exists; use a service-area map and travel-fee logic from ZIP 95624 as the local proof device.
10. **Eco angle:** Sacramento stormwater rules prohibit wash-water discharge to storm drains (City brochure); mobile detailers elsewhere advertise closed-loop/reclaim or distilled water. If the owner confirms they reclaim water, this is a legitimate, locally relevant trust block. Otherwise leave it out.

## 4. Trade clichés to avoid

- Carbon-fibre textures, hexagon/honeycomb patterns, checkered flags, speed lines, flame/chrome effects.
- Stock mechanics in coveralls, stock "happy customer" handshake photos, stock polishing-machine macro shots that are not 916's own work.
- Generic black-and-red or neon-green "performance" palettes; the cali-tints lime-on-black is already in this repo.
- Badge soup (every logo of every coating brand) when the owner holds no certification.
- Fake urgency ("Only 3 slots left!"), invented guarantees, "licensed & insured" without a number, "15+ years" without owner input.
- "Call for a quote" as the only path; a form with 10 fields.
- Stat band of invented numbers ("500+ dents fixed").
- Overuse of gold gradient. Owner limits it to hero line 3 and section numbers.
- Full-screen autoplay video with sound, heavy WebGL, cursor-follow gimmicks.
- Template look: huge dark hero plus three icon cards plus star-rating row. Differentiate with the transformation sequence, the "does my dent qualify?" explainer and the photo-quote walkthrough.

## 5. Open items for Stage 3

- Someone with a browser should open the 8 reference sites and record real hero, type and motion notes, replacing the [background] items above.
- Check Michroma licence (SIL OFL, available via Google Fonts, Likely) before self-hosting; confirm Inter likewise. Fonts must be self-hosted (BLUEPRINT rule 3).
- Contrast pairs to compute in Stage 3: Ivory on Onyx, Steel on Onyx, Gold on Onyx, Onyx on Gold (button text), Light Gold hover. Steel `#8C8F96` on Graphite `#16171A` is likely near the AA limit for small text and must be computed, not assumed.
