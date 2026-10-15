# T-916-P7: growth agent -> orchestrator
Date 2026-10-15. Phase 7 (growth pack) for 916 Dent & Detail. Drafts only; nothing sent, posted, created, contacted or spent. Touched only `916-dent-detail/marketing/**` (plus this handoff).

## Files (25, all under 916-dent-detail/marketing/)
README.md; gbp/{categories,description-750,services,qa-20,posts-12-weeks,photo-shot-list,review-requests,review-replies}.md; citations/{top-40-directories,nap-format,setup-yelp,setup-apple-business-connect,setup-bing-places,setup-nextdoor}.md; social/{bios,calendar-30-days,dm-scripts}.md; paid/{google-search,lsa-checklist,meta-ads,retargeting}.md; dealers/{door-knock-kit,wholesale-price-sheet-template,dealer-email-templates}.md.

## Script checks (python3 -I, scratchpad chk.py)
GBP description 647/750. Bios: IG 105/150, TikTok 63/80, FB 84/101, YT 530/1000. RSA: 4 sets, 71 lines all within 30 (headlines) / 90 (descriptions). Sitelinks <=25/35, 8 callouts <=25. Calendar has 30 rows. Posts: 28 across 12 weeks.

## Sourced (retrieved 2026-10-15)
- GBP SAB rules (hide address, ~2 hr, 20 areas, one profile): support.google.com/business/answer/10514137 and /3038177 (via scout research).
- RSA 15 headlines / 4 descriptions: support.google.com/google-ads/answer/7684791.
- CAN-SPAM applies to B2B, postal address + opt-out: ftc.gov business guidance.
- TCPA one-to-one rule vacated: Steptoe; revocation rules Apr 11 2025: ActiveProspect summary.
- CA: B&P 17538.41 consent; AB 1865 (9pm-9am text-ad ban) pending as of 2026-05-16: apcp.assembly.ca.gov/media/1077, govbuddy.com.
- LSA: Google help lists "Auto body shop/Vehicle body shop" and "Car wash and detailing" (some versions CA/FL only); newer "Car Detailing Service" (Search Engine Land).
- Local facts (heat, hail, sap, stormwater) reused from scout `research/local-facts.md` with its hedges.

## UNVERIFIED / weak (marked "verify in dashboard" in files)
- Google's own review-policy text was unreachable (WebFetch DNS-blocked); gating/incentive rules come from Podium, J. Turner Research, Vizup (third-party).
- GBP category names (picker never seen; competitor categories unseen); Q&A seeding availability.
- Dent removal has NO LSA category found; detailing might be eligible in CA. LSA requirements are general practice.
- Apple Business Connect SAB eligibility (forum reports say no hidden address); Yelp/Bing/Nextdoor steps (no official pages surfaced).
- Meta policy details (third-party summaries only); RSA 90-char description limit (not confirmed in search); IG/TikTok/FB bio limits and Meta text-length guidance (common practice).
- Directory list: 11 rows seen in search lists (S), rest are well-known but not re-confirmed (K); rows 39-40 are placeholders needing real targets; chamber URLs unverified.
- CIPA and B2B-text TCPA coverage not found in search; treated conservatively (consent required). Counsel review recommended.
- No dealer wholesale price, no competitor category, no stats invented; all prices and warranties are [OWNER].

## Owner decisions needed
D1 GBP primary category (dent vs detailing). D2 whether any directory may show an address (never fake). D3 dealer per-panel tiers, trial offer, COI/insurance wording. D4 ad budgets and kill thresholds. D5 LSA for detailing only. D6 SMS consent language on the booking form. Plus: real phone/domain/email/hours/review link (site.ts placeholders), legal/insurance/license confirmations (city business licenses, BAR question for PDR, insurance).

## Hard gates reminder
Every post, send, account creation, payment, and dealer contact is owner-executed. Cross-dependency: paid and retargeting need site events `quote_requested`, `booking_completed`, `call_click` and a consent banner from the website agent.
