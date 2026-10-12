# Lane A idea research cache, 2026-10-12 (scout, T-005)

Stale for reuse 2026-11-11 (re-verify); stale entirely 2027-04-12. Companion to `income-lanes-2026-10-12.md` (reuse E-refs "a1..a10, b1..b10, L1..L6" from there).

**Evidence-handling note.** 8 WebSearch calls, all 2026-10-12. The tool returns summarized blocks, not page text; no page was opened. A number is VERIFIED here only when the summary tied it to a named page whose URL is in the result list. Vendor marketing pages are valid evidence that a price is *asked*, not that anyone *paid* it. Where the summary gave a number without a clear URL, the tag is UNVERIFIED.

## Evidence table
| # | Claim | Tag | Source |
|---|---|---|---|
| E1a | Google Business Profile (GBP) one-time setup by an agency: $250-$750 | VERIFIED(https://coloradowebimpressions.com/answers/how-much-does-google-business-profile-management-cost, 2026-10-12, "Setup-only work is $250-$750 one-time") | Vendor page; profile itself is free |
| E1b | GBP setup+audit ~$300-$500 | VERIFIED(https://slashpost.ai/blogs/google-business-profile/google-business-profile-optimization-cost, 2026-10-12, "Setup and audit fees land around $300-$500 one-time") | Vendor blog |
| E1c | GBP setup+optimization $400-$700 fixed-price | VERIFIED(https://ecreations.net/shop/google-business-profile-optimization/, 2026-10-12, "lists a price range: $400 through $700") | Vendor page |
| E1d | Ongoing GBP optimization $125-$500/mo per location | UNVERIFIED(summary said "one source", URL not named) | |
| E2a | eBay drop-off store commission 35% on first $200 of sales, 30% next $300, 20% over $500 | VERIFIED(https://www.northernexpress.com/news/feature/article-1572-ebay-made-easy-the-drop-spot-harnesses-the-power-of-internet-auctions, 2026-10-12, "35% on the first $200 of sales") | One Michigan store, newspaper feature |
| E2b | Older drop-off store: 30% for items selling $20-$99, 28% $100-$299 | VERIFIED(https://valdostadailytimes.com/?p=49612, 2026-10-12, "30 percent for items selling for $20 to $99") | Old Q&A; summary says rates likely out of date |
| E2c | Drop-off stores may refuse items worth under ~$35-$50 | UNVERIFIED(single source, URL not named) | Implies people with small items have no easy outlet |
| E3a | QR-menu subscription competitor: $17/mo | VERIFIED(https://cms.menutiger.com/?p=3145, 2026-10-12, "Regular plan: $17 per month") | Vendor |
| E3b | Free static QR generators exist (competition floor $0) | VERIFIED(https://www.uniqode.com/blog/qr-code-basics/create-a-qr-code-menu-for-free, 2026-10-12, URL in result list under title "create a qr code menu for free"; summary: "unlimited static QR code creation without watermarks") | Summary attributed to "some generators", not this URL by name; treat as weak VERIFIED |
| E3c | Local one-time menu-design price in Elk Grove/Sacramento | UNKNOWN. Search "turned up few clear one-time design prices". Only a EUR 350 agency tier (unclear one-time, non-US) | |
| E3d | Printing table tents $2-$5 each | UNVERIFIED(one source, URL not named) | |
| E4a | Freelance social media management $300-$1,500/mo (lean) up to $500-$3,500/mo | UNVERIFIED(sources named only as "one guide"/"another"; URLs not attributable) | Retainer anchor, not our 30-day pack |
| E4b | AI social tools $27-$199/mo | UNVERIFIED(not tied to a URL) | Competition floor |
| E5a | Upwork freelancer sells an AI-search visibility audit, tiers $25-$99, diagnostic only | VERIFIED(https://www.upwork.com/services/product/marketing-i-will-check-if-your-business-appears-in-chatgpt-and-ai-search-2037836096632486471, 2026-10-12, "Tiers run from $25 to $99") | Proves a live market price for the audit |
| E5b | Agency AI-visibility audit + llms.txt package $449 | VERIFIED(https://www.templatemonster.com/services/ai-search-optimization/, 2026-10-12, "A $449 package covers an AI visibility audit, competitor comparison") | Vendor; 5-7 business days |
| E5c | Self-serve audit tools charge cents-dollars per run (Apify actors) | VERIFIED(https://apify.com/bovi/ai-visibility-audit, 2026-10-12, "from $4.37 / 1,000 audit-rows") | Floor competition |
| E6 | Shopify store setup by freelancer $500-$1,500 basic; $2,000-$5,000 typical | UNVERIFIED(figures from unnamed guides; vendor blogs) | Not used for any ranked idea |
| E7 | Website care plan $50-$300/mo (tiers $39-$79 basic, $99-$220 mid, $99-$299 an agency) | UNVERIFIED(summary gave "one guide"/"one provider" with no URL ties; consistent with cache a5) | Competition and payer range; ask owner what the two clients pay |
| E8a | English-Spanish translation $0.23/word, $57.50/page (250 words) | VERIFIED(https://blogs.extension.wisc.edu/oaic/files/2023/02/Estimating-the-cost-of-Language-Access-services_02.28.23.pdf, 2026-10-12, "$0.23 per word and $57.50 per page") | 2023 university estimate; text only |
| E8b | Freelance Spanish translation $45/page, 300-word page, 1-week delivery | VERIFIED(https://www.servicescape.com/translators/ermarsot, 2026-10-12, "$45.00 USD per page") | One listing |
| E8c | Price of localizing a live US small-business website | UNKNOWN. Not found; plain text translation rates understate it | |
| E9 | Blueprint ships bilingual option, "on by default for any consumer trade in California" | VERIFIED(repo blueprint/MASTER-BLUEPRINT.md section 1 table, 2026-10-12, "Bilingual (optional) ... on by default for any consumer trade in California") | |
| E10 | Cali Tints has Stripe deposit checkout, lead capture, chat assistant as serverless functions | VERIFIED(repo sites/cali-tints/netlify/functions/, 2026-10-12, files checkout.mjs, stripe-webhook.mjs, leads.mjs, chat.mjs) | Phil's Auto is a Python static build with no such functions (VERIFIED repo sites/phils-auto-fleet-repair/README.md "No frameworks, no build toolchain") |
| E11 | Cali Tints ships llms.txt, robots allowlist, IndexNow, JSON-LD | VERIFIED(repo sites/cali-tints/public/llms.txt exists; README "JSON-LD, llms.txt, IndexNow", 2026-10-12) | Basis for AI-search audit/fix offers |
| E12 | Build playbook: build starts only after a written agreement and logged deposit; pitch previews only under SP-2 | VERIFIED(repo library/playbooks/local-site-build.md, 2026-10-12, "Spec builds for a pitch are allowed only as a preview with a standing permission (SP-2)") | SP-2 is "proposed; inactive until A-003 = yes" (ops/DECISIONS.md) |
| E13 | Sandbox cannot fetch commercial sites; agents cannot read a client's live site | VERIFIED(repo ops/CONTEXT.md, 2026-10-12, "raw HTTP and WebFetch to commercial hosts return 403") | Limits audit-type ideas: owner must supply screenshots/PageSpeed output from phone |

## Not searched (left UNKNOWN)
Trade-in payout levels (Apple/Best Buy/Gazelle/Decluttr) for I-016; wholesale site-build demand from sign/print shops for I-020; walk-in conversion rates; Sacramento-specific pricing for anything. Each ranked as UNVERIFIED in `ops/IDEAS.md`.

## Searches used (8 of 8)
GBP setup price · eBay drop-off commission · QR menu design price · social media management price · AI-search/GEO audit price · Shopify setup price · website care plan price · Spanish site translation price.
