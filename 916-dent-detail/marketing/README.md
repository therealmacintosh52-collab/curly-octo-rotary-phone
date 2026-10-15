# 916 Dent & Detail: Growth Pack (Phase 7)

Status: DRAFT, 2026-10-15. Everything here is copy-paste-ready text. **Nothing has been sent, posted, created, or paid for.** Every posting, sending, account creation, payment, and contact is owner-executed (hard gates in `CLAUDE.md`). Placeholders: `[OWNER PHONE]`, `[OWNER DOMAIN]`, `[OWNER EMAIL]`, `[OWNER GOOGLE REVIEW LINK]`, `[OWNER HOURS]`, `[OWNER ...]` decisions. `site.ts` still holds the fictional phone `(916) 555-0100` and `hello@example.com`: never publish those.

Brand rules used throughout: voice confident, premium, plain-spoken; plain service names ("Dent Removal (no paint, no body shop)", "Swirl & Scratch Erase", "Gloss Shield", "Paint Deep-Clean", "Hail Fix", "Interior Reset"); single offer and CTA everywhere: **Get a price from a photo** -> `[OWNER DOMAIN]/book`. No invented stats, awards, reviews, years in business or prices.

## Index
| Folder | Files |
|---|---|
| `gbp/` | categories, description-750, services, qa-20, posts-12-weeks, photo-shot-list, review-requests, review-replies |
| `citations/` | top-40-directories, nap-format, setup-yelp, setup-apple-business-connect, setup-bing-places, setup-nextdoor |
| `social/` | bios, calendar-30-days, dm-scripts |
| `paid/` | google-search, lsa-checklist, meta-ads, retargeting |
| `dealers/` | door-knock-kit, wholesale-price-sheet-template, dealer-email-templates |
| `research/` | scout inputs (read-only, not edited here) |

## Who does what
- Claude (drafts): all files in this folder.
- Owner (executes, gated): every item below. Time estimates are mine; expected $ is **not estimated** because no sourced conversion or ticket data exists. Rank is by value per minute of owner time, reasoned from: free, fast, and closest to a booked job first.
- Website agent: builds the site in parallel (`/book`, `/dealers`, analytics events `quote_requested`, `booking_completed`, `call_click`). Paid and retargeting wait for those events.
- Later: Phase 3 /admin logs leads (sources Google, GBP, Meta ads, IG, TikTok, door-knock, referral, dealer + UTM). Verify exact field names when live.

## Owner actions in order (value per minute, highest first)
| # | Action | Minutes | Why now | Files | Gate |
|---|---|---|---|---|---|
| 0 | Fill real phone, domain, email, hours, review link into `site.ts` and these files | 20 | Blocks every listing | nap-format | Owner data |
| 1 | Claim and verify Google Business Profile; set service area, hide address; paste categories, description, services | 60-90 | Free, shows on Google/Maps | gbp/categories, description-750, services | Creating account, verification |
| 2 | Shoot the core photo set (20 shots) | 45-60 | GBP, social and ads all need real photos | gbp/photo-shot-list | None |
| 3 | Door-knock Roseville Auto Mall / Folsom Auto Mall / Elk Grove cluster, mornings | 120-180 per route | Dealers are repeat B2B; no sourced wholesale price yet, so set prices first | dealers/* | Contacting anyone; prices [OWNER] |
| 4 | Ask every finished job for a review (same message every time) | 5 per job | Cheapest differentiator (competitors show about 4-121 reviews per scout, single-search observation) | gbp/review-requests | Texting consent |
| 5 | Citations P1: Bing (import), Yelp, Facebook, Instagram, Nextdoor (Apple if allowed) | 90 | Consistency + extra discovery | citations/* | Creating accounts |
| 6 | Post the first 7 GBP posts and 5 reels | 120 | Activity and proof | gbp/posts, social/calendar | Publishing |
| 7 | Seed Q&A / FAQ and reply templates | 30 | Reduces repeated questions | gbp/qa-20, review-replies | Publishing |
| 8 | LSA pre-check (stop before payment) | 10 | Likely no dent category: confirm | paid/lsa-checklist | Account |
| 9 | Google Search C1 launch after tracking test and budget decision | 90 setup | Intent traffic | paid/google-search | Spending, account, payment |
| 10 | Meta prospecting + retargeting | 90 setup | Only after real reveals exist | paid/meta-ads, retargeting | Spending, pixel/consent |

## Owner decisions needed (also in the handoff)
- D1 GBP primary category: dent removal vs detailing (`gbp/categories.md`).
- D2 Whether any directory (Apple, Yelp) may show an address; never a fake address (`citations/nap-format.md`).
- D3 Dealer wholesale price tiers, COI wording, trial-car offer (`dealers/`).
- D4 Ad budgets and kill thresholds (`paid/google-search.md` section 9).
- D5 Whether to pursue LSA for detailing only (`paid/lsa-checklist.md`).
- D6 Texting program: written consent language on the booking form before any SMS marketing.

## UTM convention (matches /admin lead source capture)
`utm_source` = google | bing | apple | yelp | nextdoor | facebook | instagram | tiktok | youtube | meta | email | door-knock; `utm_medium` = gbp | cpc | paid | social | dm | email | qr; `utm_campaign` = descriptive (post-w03, cal-d12, M4, dealer-e1). Example: `https://[OWNER DOMAIN]/book?utm_source=google&utm_medium=gbp&utm_campaign=post-w03`.

## Source confidence (retrieved 2026-10-15)
Strong (official help seen in search results): Google service-area rules (support.google.com/business/answer/10514137, /3038177), RSA 15 headlines + 4 descriptions (support.google.com/google-ads/answer/7684791), FTC CAN-SPAM guide (ftc.gov).
Medium (reputable trade/legal summaries): TCPA one-to-one rule vacated (Steptoe), California text law context (Assembly analysis, GovBuddy on AB 1865).
Weak (third-party only, marked "verify in dashboard"): Google review policy details (Google's page unreachable), LSA categories, Apple/Yelp/Bing/Nextdoor setup steps, Meta ad policy, citation list, character limits for IG/TikTok/FB bios and RSA descriptions.
Not found: dealer wholesale prices, competitor GBP categories, any Sacramento mobile-washer rule, official Yelp/Apple steps.

## Quality checks
Character limits are asserted by a script (GBP description 750, RSA 30/90, sitelinks 25/35, callouts 25, bios). The result is recorded in `ops/handoffs/T-916-P7-agent-to-orchestrator.md`. Re-run if any copy changes.
