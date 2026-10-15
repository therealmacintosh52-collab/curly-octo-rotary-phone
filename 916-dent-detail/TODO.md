# TODO — 916 Dent & Detail

`npm run check:owner` lists every placeholder still in code (41 lines at end of Phase 1).

## [OWNER] items: business facts (blockers for launch)
- [ ] Real business phone → `src/config/site.ts` `phone` (now the fictional (916) 555-0100), set `placeholder: false`
- [ ] Real inbox → `site.email` (now hello@example.com)
- [ ] Hours for Mon–Fri / Sat / Sun → `site.hours`
- [ ] Production domain → `NEXT_PUBLIC_SITE_URL` (canonical + OG URLs)
- [ ] Google review link (g.page/r/…) → `site.googleReviewUrl`
- [ ] Social profile URLs (Instagram, Facebook, TikTok, YouTube, Google) → `site.social`
- [ ] Legal business name if it differs from "916 Dent & Detail"

## [OWNER] items: prices and offers (never hardcoded; all in `src/config/pricing.ts`)
- [ ] "From" price per service (6) → `serviceFromPrice`
- [ ] Membership prices (Maintain / Protect / Showroom) → `memberships[].priceMonthly`
- [ ] Confirm or rewrite what each membership tier includes (current lists are proposals)
- [ ] Dealer per-panel wholesale price sheet (shown as a marker on /dealers)

## [OWNER] items: proof and claims to confirm
- [ ] 3 real customer reviews (with permission) for Reviews section and /reviews; NO invented reviews, no star ratings
- [ ] Real before/after job photos, 3 pairs (dent, swirls, interior) → replace `PanelArt` placeholders
- [ ] `[OWNER: confirm reclaim equipment & permits]`: eco section says low-water methods, runoff captured, kept out of storm drains, "the way Sacramento-area stormwater rules intend". Confirm each is true or tell us what to soften
- [ ] Confirm "COI on request" (certificate of insurance) for dealers
- [ ] Confirm "same-day on-lot" for dealers
- [ ] Confirm we will photograph hail damage / give an estimate to support insurance claims (Hail Fix card + FAQ)
- [ ] Confirm the 14-city service list (Sacramento, Elk Grove, Roseville, Folsom, Rancho Cordova, Citrus Heights, Natomas, West Sacramento, Davis, Carmichael, Granite Bay, El Dorado Hills, Lincoln, Rocklin)

## [OWNER] media (see handoff assessment for detail)
- [ ] Optional: a horizontal (16:9) version of the hero video for desktop (`brand/hero-video-wide.mp4`); the pipeline picks it up next phase
- [ ] Optional: higher-resolution source (1080w+) of the vertical video; the 720w frames are soft on large retina panels
- [ ] Optional: a re-render of the dent-pop moment (frames ~24-44 of the source show a white chip and a ghost ring)
- [ ] Optional: a flat/vector version of the D-mark (favicons at 16/32 px are limited by the 3D bevel source)

## Engineering follow-ups (Phase 1 leftovers)
- [ ] Mobile Lighthouse LCP median 2.6 s (simulated) vs target 2.5 s: options in handoff (variable Inter, HTTP/2 host, drop Inter 600)
- [ ] INP not measured (needs field data or a scripted interaction trace)
- [ ] Mobile frame set is 12.1 MB total; consider 540w q70 (~5.8 MB) if field data shows heavy users on cellular
- [x] Wire `track()` to GA4/Meta/Ads (Phase 6 done; needs the IDs below)

## Remaining phases (SPEC.md)
- [ ] Phase 2: booking engine (/book): services → vehicle → photos → ZIP/travel fee from 95624 → availability → contact → Stripe deposit → confirmation; AI photo quote range; SMS/email automations
- [ ] Phase 3: CRM + /admin (Supabase, RLS), pipeline, tech view, memberships via Stripe, referrals, reports
- [ ] Phase 4: 916 Concierge assistant (site chat + Twilio SMS), tools, guardrails, missed-call text-back
- [ ] Phase 5: dealer portal (/dealers accounts, bulk VIN submission, statements, net terms, leave-behind PDF)
- [x] Phase 6: SEO + local (9 service pages, 14 city pages, JSON-LD, sitemap/robots, MDX blog, tracking). Built locally; see the Phase 6 section below for owner items
- [ ] Phase 7: growth pack (/marketing markdown)
- [ ] Phase 8: tests, Lighthouse CI, axe, bot scenarios, seed data, setup README, deploy script

## Phase 6 (SEO + local): [OWNER] items
- [ ] Set `NEXT_PUBLIC_SITE_URL` before the production build (canonicals, sitemap, schema, RSS all derive from it)
- [ ] Tracking IDs: `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_GADS_ID` (or `_GOOGLE_ADS_ID`) + `_LABEL_QUOTE/_BOOKING/_CALL`, `META_CAPI_ACCESS_TOKEN`. Banner and scripts stay off until one is set
- [ ] Privacy policy page + `NEXT_PUBLIC_PRIVACY_URL` (consent banner links to it). Have counsel review the banner wording and the CCPA/CPRA posture
- [ ] Phase 2: call `sendCapiEvent` (src/lib/analytics/capi.ts) from the booking API with the browser `event_id` and the visitor's marketing consent; nothing calls it yet
- [ ] Confirm public statements on service pages: low-water methods / wash water kept out of storm drains; COI available on request; "we work in your garage/driveway"; no warranty claims were written
- [ ] Confirm we are happy to say Elk Grove is nearest our base (derived from base ZIP 95624) and that city pages print "We start from ZIP 95624" (src/lib/seo/travel.ts)
- [ ] Per-city `distance` bands (near/mid/far) and drive notes in `src/content/seo/cities/*.ts` are qualitative guesses; adjust to real drive times/travel tiers
- [ ] Sourced but dated, re-check before publishing: 2018 hail accumulation (up to 3 in), 2023-03-11 NWS warning (south/east of city), CBS hail report in Roseville/Citrus Heights/Natomas (year not seen), Natomas carport collapse, 2024 record triple-digit days, Intel layoffs 2025, Rocklin 2017 employer list, Sacramento stormwater commercial car-wash sheet
- [ ] Add real job photos to service pages (none used; no alt-text images yet)

### [OWNER] map-check before publishing (unsourced local items named on city pages; verify each exists/is described correctly)
- Sacramento: Midtown and East Sacramento street parking; Arden Fair; Auburn Boulevard dealer strip; tree-lined streets / shade
- Elk Grove: Old Town Elk Grove; Highway 99 commuter route
- Roseville: Blue Oaks Boulevard retail; Kaiser and Sutter hospitals as large employers
- Folsom: Folsom Lake; Historic Sutter Street; tech-campus commuter framing
- Rancho Cordova: Sunrise Boulevard corridor; Mather area; Cordova Town Center; Highway 50 position
- Citrus Heights: Sunrise Mall area; Greenback Lane; Auburn Boulevard; "older cars" framing
- Natomas: Natomas Marketplace; airport adjacency; I-5 / I-80; "newer subdivisions" framing
- West Sacramento: Raley Field; Port of West Sacramento; I-80 / Hwy 50; fleet/warehouse framing
- Davis: UC Davis; downtown; Mace Boulevard; cycling culture; Hanlees named only as a Chiles Road landmark
- Carmichael: Fair Oaks Boulevard; American River; mature trees / older neighborhoods; steep or narrow driveways
- Granite Bay: Folsom Lake; Douglas Boulevard; Eureka Road; higher-value car framing; garage size
- El Dorado Hills: Town Center; Highway 50; Serrano; hillside / gated-community framing
- Lincoln: Highway 65; Lincoln Crossing; Twelve Bridges; truck/SUV framing
- Rocklin: Quarry Park; Blue Oaks / Hwy 65; Sunset Boulevard; school-lot framing
- Auto malls named on dealer/city pages are public landmarks only (Roseville Automall on Automall Dr, Folsom auto mall off Hwy 50, Elk Grove Auto Mall, Automall Parkway in Rancho Cordova, Hanlees on Chiles Rd); no customer relationship is claimed
