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
- [ ] Wire `track()` to GA4/Meta/Ads (Phase 6)

## Remaining phases (SPEC.md)
- [ ] Phase 2: booking engine (/book): services → vehicle → photos → ZIP/travel fee from 95624 → availability → contact → Stripe deposit → confirmation; AI photo quote range; SMS/email automations
- [ ] Phase 3: CRM + /admin (Supabase, RLS), pipeline, tech view, memberships via Stripe, referrals, reports
- [ ] Phase 4: 916 Concierge assistant (site chat + Twilio SMS), tools, guardrails, missed-call text-back
- [ ] Phase 5: dealer portal (/dealers accounts, bulk VIN submission, statements, net terms, leave-behind PDF)
- [ ] Phase 6: SEO + local (9 service pages, 14 city pages, JSON-LD, sitemap/robots, MDX blog, tracking)
- [ ] Phase 7: growth pack (/marketing markdown)
- [ ] Phase 8: tests, Lighthouse CI, axe, bot scenarios, seed data, setup README, deploy script
