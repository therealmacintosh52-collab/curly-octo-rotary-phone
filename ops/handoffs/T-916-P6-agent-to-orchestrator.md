# T-916-P6 agent -> orchestrator: Phase 6 (SEO + local), 916 Dent & Detail
Branch claude/916-dent-detail-build. Commits: 5e3a9ac (steps 1-2), 2a0a43f (step 3), 2259968 (step 5), robots tweak, 968d41f (step 6 docs). Not pushed, nothing deployed, no accounts, no spend.

## Evidence (quoted from runs)
- tsc --noEmit: no output. `eslint .`: no output (whole project).
- `npm run build` (prebuild gate + next build): "Compiled successfully", "Generating static pages (61/61)".
- check:content: "services: max 0.50% mean 0.09% threshold 35%", "cities: max 2.43% mean 0.43%", "blog: max 0.77% mean 0.13%", "check-similarity: OK". Words: services 1040-1439, cities 562-674 are the pre-fix numbers; final min city 608 (rancho-cordova), posts 921-1136.
- check:seo: "pages crawled: 56 html 200: 55 services: 9 cities: 14 posts: 10 / sitemap urls: 45 JSON-LD blocks parsed: 165 redirects verified: 25/25 rss items: 10 / [check:seo] OK". (It first FAILED on / and /services descriptions at 158/159 chars; fixed.)
- axe (wcag2a/aa/21/22 + best-practice), service, city, blog, hub, mobile + desktop: 0 violations on all 8, no horizontal overflow.
- Lighthouse mobile (local prod build, 2 to 3 runs, machine under load from parallel agents): home perf 96 / 81; /services/paintless-dent-repair 94 / 89; /areas/folsom 91 / 93; /services/door-ding-repair 95 / 94 / 85. a11y/best-practices/SEO 100 everywhere. CLS 0. LCP 2.0-3.1 s, TBT 150-500 ms. Dips below 90 coincide with load average ~3.8 (other builds running); not reproduced as a steady miss, but not proven >=90 on every run.
- Tracking test (build with fake GA4/Meta IDs, Playwright): banner visible, "tracker requests before consent: 0", after Accept all requests to googletagmanager gtag/js and connect.facebook.net fbevents.js; delegated tel: click pushed `call_click`; UTM/gclid persisted to localStorage on landing. (Network to Google/Meta is blocked in this sandbox, so no real hit was delivered.)
- Screenshots viewed: service page mobile + desktop look correct (breadcrumb, hero, sticky quick-facts aside). City and blog screenshots were captured (.shots/seo) but I only visually inspected the service page.

## What is NOT verified
- No real GA4/Meta/Ads/CAPI delivery (no keys, sandbox network). CAPI only mock-logged; no code calls `sendCapiEvent` yet (Phase 2 must, with browser event_id + marketing consent).
- City/blog screenshots not eyeballed; Lighthouse not run on a blog page or on real hosting; INP not measured; Vercel Analytics unverified off-Vercel.
- Rich Results Test / Search Console not run (no network). JSON-LD only checked for parse + forbidden keys.
- check:seo never ran with site.phone.placeholder=false (omission branch untested); placeholder=true branch passes.
- Local facts: only what is sourced in marketing/research; every unsourced place is in TODO "[OWNER] map-check". Hail/heat/news facts are dated and need a re-check.

## Risks
- Shared files edited minimally: Footer, Sections (home grid links), CtaLinks (call/text onClick replaced by delegated listener), JsonLd, layout (metadata description, analytics mounts), attribution.ts (appended), tsconfig (allowImportingTsExtensions), eslint ignores, .env.example, package.json scripts, next.config.ts (distDir env, redirects, image formats).
- Redirect map claims generic slugs (/contact, /estimate, /about ...). Phase 2/3 must not create real routes at those paths; /booking/[token] is unaffected (exact match only).
- Public copy makes soft operational claims the owner must confirm: low-water methods/no storm-drain discharge, COI on request, "We start from ZIP 95624", Elk Grove nearest base, hail estimates for claims, detailing scope. No warranties, prices, years, ratings or reviews were written.
- Banner/GPC handling is a reasonable CA posture, not legal advice; no privacy policy page exists yet.
- OG image routes are dynamic (render on request); fine on Vercel, not prerendered.
- Packages added: next-mdx-remote 6, @vercel/analytics 2.
