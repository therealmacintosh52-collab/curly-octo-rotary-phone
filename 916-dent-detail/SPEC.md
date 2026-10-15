# 916 DENT & DETAIL — owner spec (verbatim intent; source of truth for all phases)

Mobile paintless dent repair (PDR) + auto detailing, Sacramento CA. Two owner-technicians + crew. Retail AND B2B (dealerships, fleets, rental lots, body shops). Production-ready, end to end. Decide yourself; log assumptions in DECISIONS.md, keep TODO.md updated, commit after each phase.

## BRAND
- Name: 916 Dent & Detail. Tagline "Precision · Care · Perfection." Hero line: "Dents gone. Paint glowing. We come to you."
- Voice: confident, premium, plain-spoken, zero jargon up front.
- Assets in /brand: logo.jpg (gold 3D on black, 1408x1408), hero-beading.png (1122x1402), hero-video.mp4 (10s 720x1280 24fps; strip audio; use hero-video-wide.mp4 for desktop if it exists).
- Logo derivatives: logo-transparent.png (remove black bg), D-mark-only crop, favicon set 16/32/180/512, apple-touch icon, OG 1200x630 (logo centered on black + subtle gold particle glow).
- Palette: Onyx #0B0B0C bg · Graphite #16171A surfaces · Gold #C9A24A primary accent/CTAs · Light Gold #E8CB7A hover · Ivory #F3EEE3 text · Steel #8C8F96 secondary text. Gold = accent only (CTAs, key lines, icons), never large blocks. Metallic gradient (#8E6E2E → #E8CB7A → #B8913E) on headings ONLY where it adds impact (hero line 3, section numbers).
- Type: Michroma (display) + Inter (body). Self-host, font-display: swap.
- Feel: luxury automotive studio at night. Dark, glossy, negative space, one bold moment per section.

## PLAIN-LANGUAGE RULE
PDR → "Dent Removal (no paint, no body shop)" · Paint correction → "Swirl & Scratch Erase" · Ceramic coating → "Gloss Shield" · Clay/decon → "Paint Deep-Clean" · Hail repair → "Hail Fix" · Interior detail → "Interior Reset". Real terms stay in H2s, alt text, schema, FAQs.

## STACK
Next.js (latest stable, App Router, TS), Tailwind, GSAP+ScrollTrigger, Lenis. R3F only for optional small gold particle accent; hero = video scrub, NOT heavy WebGL. Supabase (Postgres/Auth/Storage/RLS). Stripe (deposits, invoices, memberships). Twilio SMS. Resend email. Anthropic API assistant, model "claude-sonnet-5-5" with tool use. Vercel deploy. Secrets in .env.local, documented in .env.example. ffmpeg for media.

## PHASE 1: SCROLL-SCRUB HERO + MARKETING SITE
HERO: ffmpeg → ~120 WebP frames q80, mobile (720w) + desktop (wide video if present else same frames). Canvas; scroll progress over first ~250vh (pinned) → frame index. Preload first 10 frames, lazy-load rest. Frame 0 instant poster (LCP-safe).
Overlay copy (real SSR HTML) synced: 0–30% "Dents gone." · 30–60% "Paint glowing." · 60–100% "We come to you." (gold gradient) + subhead "Mobile paintless dent repair & detailing across Sacramento. No body shop. No repaint." + CTAs. Primary gold "Get a price from a photo"; secondary outline "Book now".
Desktop (no wide video): vertical scrub in tall rounded panel on right (55% width), hero-beading.png blurred+darkened behind; copy left. Mobile: full-bleed vertical scrub, copy at top, sticky bottom CTA bar (Call / Text / Get price). Logo top-left (transparent PNG); nav: Services, Dealers, Pricing, Reviews, Book. prefers-reduced-motion or low-end device → static frame + fade-in copy, no scrub.
REST OF SITE (one orchestrated motion per section, nothing gimmicky): How it works (send a photo / we come to you / drive away fixed) · Services grid (plain-language names) · Before/after drag sliders (placeholders marked [REPLACE WITH REAL JOB PHOTOS]) · Gloss Shield section using hero-beading.png · "Eco-friendly, no runoff" (water reclaim, Sacramento stormwater compliance) · Reviews · service-area map · memberships · dealer section · FAQ · footer with NAP + hours.
Targets: Lighthouse mobile 90+, LCP<2.5s, CLS<0.1, INP<200ms, a11y AA, keyboard focus, alt text.

## PHASE 2: BOOKING ENGINE
Steps: 1 Service(s) · 2 Vehicle (Y/M/M + size class) · 3 Photos (required for dents) · 4 ZIP → service-area check + travel fee by radius from base ZIP 95624 (configurable) · 5 Date/time from real availability · 6 Contact · 7 Stripe deposit · 8 Confirmation.
Availability: per-tech calendars, duration by service × vehicle size, travel buffers, blackout dates, weather flag for exterior work, admin time blocks, optional Google Calendar sync.
Instant photo quote: AI returns price RANGE + confidence, always labeled "Estimate — final price confirmed on inspection." All prices in config/pricing.ts as editable placeholders marked [OWNER]; never hardcode prices in UI.
Automations: confirmation SMS+email · reminders 24h and 2h · "On the way" text w/ ETA · post-job invoice + Google review request 2h after completion · 6-month rebook nudge. Reschedule/cancel links with deposit policy.

## PHASE 3: CRM + ADMIN (/admin, owner logins, phone-first)
Records: customers, vehicles, jobs, quotes, invoices, payments, notes, per-job photos (before/after, marketing-consent toggle). Pipeline: New lead → Quoted → Booked → In progress → Done → Reviewed. Lead source: Google, GBP, Meta ads, IG, TikTok, door-knock, referral, dealer + UTM capture. Tech view: today's route in order, tap-to-navigate, start/finish job, photo capture, take payment, signature. Memberships via Stripe subscriptions. Referral codes with credit. Reports: revenue by service/source/tech, close rate, avg ticket, reviews/week, ad CPA.

## PHASE 4: AI BOOKING ASSISTANT ("916 Concierge")
Premium, friendly, short answers. Channels: site chat + SMS (Twilio webhook), shared memory per customer in Supabase; architect for IG/FB DMs later. Tools: get_services, check_service_area(zip), get_quote_range(photos, vehicle), check_availability(service, zip, range), create_booking, send_deposit_link, reschedule_booking, cancel_booking, lookup_booking(phone), create_lead, escalate_to_human (texts owners a summary).
Rules: always move toward a booked slot; ask for photos before quoting dents, never promise fixed dent price without photos; never invent availability; handle objections (price vs body shop, paint safety, water/power needs); hand off on complaints/insurance claims/uncertainty; log every conversation to CRM as a lead. Missed-call text-back within 60s that starts the bot. Guardrails: prompt-injection defense, rate limits, per-conversation cost cap.

## PHASE 5: DEALER PORTAL (/dealers)
Landing for used-car managers: faster frontline-ready recon, per-panel wholesale pricing [OWNER], same-day on-lot, COI on request. Dealer accounts: bulk vehicle submission (VIN, stock #, photos, notes), status tracking, add-on approvals, monthly statements, net-terms invoices via Stripe. Printable black-and-gold leave-behind PDF with QR to dealer signup.

## PHASE 6: SEO + LOCAL
Service pages (unique, 900+ words, real FAQs): paintless dent repair, door ding repair, hail damage repair, mobile detailing, interior detailing, paint correction, ceramic coating, headlight restoration, dealership recon.
City pages (genuinely unique: landmarks, neighborhoods, typical jobs, local FAQs; NOT doorway clones): Sacramento, Elk Grove, Roseville, Folsom, Rancho Cordova, Citrus Heights, Natomas, West Sacramento, Davis, Carmichael, Granite Bay, El Dorado Hills, Lincoln, Rocklin.
Titles lead with service + "Sacramento" (e.g. "Mobile Dent Repair Sacramento | 916 Dent & Detail"). JSON-LD: AutoRepair + LocalBusiness as service-area business (no street address shown), Service, Offer, FAQPage, BreadcrumbList, Organization w/ sameAs; NO self-serving aggregateRating. Technical: sitemap, robots, canonicals, OG/Twitter, AVIF/WebP, hub-and-spoke links, breadcrumbs, 404, redirects map. MDX blog, 10 starter posts on real local questions. Tracking: GA4 + Vercel Analytics, Meta Pixel + CAPI, Google Ads conversions; events quote_requested, booking_started, booking_completed, call_click, text_click; persist UTMs to CRM.

## PHASE 7: GROWTH PACK (/marketing markdown)
GBP (categories researched from top Sacramento PDR/mobile detail profiles, 750-char description, services, 20 Q&As, 12 weeks posts, photo shot list, review-request scripts + reply templates). Citations: top 40 directories w/ exact NAP; Yelp, Apple Business Connect, Bing Places, Nextdoor. Social: bios IG/TikTok/FB/YouTube, 30-day short-form calendar (hooks, captions, local hashtags), DM scripts → booking link. Paid: Google Search structure (keywords, negatives, ads, extensions), LSA checklist, Meta angles + 10 scripts, retargeting. Dealer door-knock kit: 30-sec script, objections, day 0/2/7/14 sequence, wholesale price sheet template [OWNER].

## PHASE 8: QA + LAUNCH
Unit tests (pricing, availability, booking), Playwright E2E (booking + bot), Lighthouse CI, axe audit. Bot test: 15 tricky scenarios (haggling, out-of-area ZIP, no photos, angry customer, prompt injection). Seed data, admin setup script, README with exact setup steps for every key, one-command Vercel deploy. Final report: what's live, [OWNER] items (real prices, job photos, phone, Google review link, hours), launch checklist.

DEFINITION OF DONE: customer finds us on Google → scrolls gold-on-black hero (dented door → beaded gloss) → photo quote → chats/texts bot → books → pays deposit → reminders → review. Owners run everything from /admin on phones; dealers submit vehicles in bulk.

## Org constraints (from repo CLAUDE.md hard gates)
Builder NEVER: deploys to production, creates accounts, enters payment info, publishes, contacts anyone, spends money. All external services are code + .env.example only, with graceful fallbacks when keys are absent (demo/mock mode) so the app builds and runs locally with zero keys.
