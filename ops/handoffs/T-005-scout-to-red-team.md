# T-005 — scout → red-team

**Status:** DELIVERED
**Task:** Asset inventory + 20 Lane A ideas (I-001..I-020) into `ops/IDEAS.md`, with payer evidence and owner phone steps
**Attempt:** 1 of 3
**Cost:** ~230k in / ~35k out tokens est., ~25 min wall, 8 WebSearch calls (budget 8) · model sonnet

## What was done
Read the agent file, PROTOCOL, CONTEXT, failure patterns and my T-001 cache. Built the asset inventory below. Ran 8 searches on payer evidence for new idea types only. Wrote 20 rows to `ops/IDEAS.md` (all `queued`). Checked repo facts the ideas lean on (booking functions, bilingual option, build playbook gate).

## Outputs
- `ops/IDEAS.md` — rows I-001..I-020, legend of flags [PR] [OA] [SP]
- `library/research/lane-a-ideas-2026-10-12.md` — evidence table E1..E13, searches used; README index updated
- This handoff

## Asset inventory (source: ops/CONTEXT.md)
| # | Asset | State 2026-10-12 | Monetize this week | Ideas |
|---|---|---|---|---|
| 1 | `blueprint/` (3 files) + `library/playbooks/local-site-build.md` | Complete, "proven (two sites shipped)" | Fixed-price done-for-you sites; build gate: written yes + logged deposit | I-001,002,004,018,020 |
| 2 | `sites/cali-tints/` | Complete reference build, has booking/Stripe/chat functions, AI-search kit. UNKNOWN: did the client pay | Live demo to show on a phone; care plan; add-ons; referrals | I-005,006,007,008 |
| 3 | `sites/phils-auto-fleet-repair/` | Complete static Python build (25 pages), Lodi. UNKNOWN: paid or spec | Demo for auto trades; care plan; booking add-on | I-002,005,007 |
| 4 | AI-search kit (llms.txt, robots allowlist, IndexNow, JSON-LD) | Built into Cali Tints | Standalone audit offer | I-009,017,019 |
| 5 | Prospect list (10 businesses) + exclusion list (8 with sites) | Listing only, has-website UNKNOWN | Target set for pitches | I-001,002,009,019 |
| 6 | Connectors: Vercel, GitHub, Lovable, Drive, Upwork, Shopify, Zendrop | Live; Gmail Forbidden | Builds/previews. Upwork seller account: UNKNOWN (connector only searches/prepares job posts) | all builds |
| 7 | Trendlift data (19-product landed-cost research, post-mortem) | Store frozen, $0 revenue, Zendrop $29/mo | Liability. Knowledge only; no Lane A row, one Lane B candidate later | none |
| 8 | ClipForge | Needs a PC | Not monetizable by a phone-only owner (FP-06) | none |
| 9 | Owner skills: reselling, Shopify, investing, content; 3-7 h/week; phone; Elk Grove | Stated | Selling owned items, consignment, local walk-ins. Investing = regulated advice, excluded | I-013,014,015 |
| U1 | Owned items to sell | UNKNOWN (CONTEXT unknown 8) | Drives I-013, I-016 amount | I-013,016 |
| U2 | Personal services the owner can deliver (driving, assembly, cleaning, photo, reselling for others) | UNKNOWN | No service row written beyond consignment; owner answer would add 5+ rows | none yet |
| U3 | Payment rail (Stripe/Square/PayPal/Zelle/Venmo) | UNKNOWN (CONTEXT unknown 2) | Blocks every service row's first dollar [PR] | all service rows |
| U4 | Platform logins (FB Marketplace, OfferUp, eBay, Mercari) and cash on hand | UNKNOWN | Blocks I-013..016 | I-013..016 |
| U5 | Business license / DBA; which city (Elk Grove vs Sacramento) | UNKNOWN (cache L1..L6) | Invoicing legality check before first service sale | red-team |
| U6 | Existing clients, audience, followers beyond the two sites | UNKNOWN | Warm intros are the fastest first dollar | I-005,006 |
| U7 | Spanish reader for proofing | UNKNOWN | Needed for I-008 | I-008 |
| U8 | Sender identity (phone/email) for outreach | UNKNOWN | Needed before any [OA] step | all [OA] |

## Idea mix (20, all Lane A)
Lenses: Repackage 4 (001,005,008,009) · Bundling/unbundling 4 (002,007,012,018) · Speed 3 (004,006,013) · Contrarian 3 (003,015,017) · Arbitrage 2 (014,016) · Picks-and-shovels 2 (010,020) · Pain mining 2 (011,019). Sources per PROTOCOL 7: services 001-004,009-012,017,019; existing-site upsell/referral 005-008; owned items 013,014,015,016; deposits/prepay 004,018; wholesale 020.

## Top-5 guess (scout's guess only; red-team decides)
1. I-005 care plan for the two finished sites — warm payer, zero build, but dead if they were spec builds (U6).
2. I-003 GBP copy-paste pack $99 — priced below three VERIFIED agency anchors, delivered in hours, no website needed.
3. I-009 AI-search readiness check $49 — VERIFIED market tiers $25-$99, uses an existing kit, but agents cannot fetch client sites (E13).
4. I-001 founding-client sites for beauty studios — real prospects, but needs a Maps check and a payment rail first.
5. I-013 sell-owned-items sweep — fastest possible cash, amount entirely UNKNOWN.

## Evidence (summary; full table in the cache)
| # | Claim | Tag | Source |
|---|---|---|---|
| 1 | GBP setup sells for $250-$750 one-time | VERIFIED | coloradowebimpressions.com/answers/how-much-does-google-business-profile-management-cost · 2026-10-12 · "Setup-only work is $250-$750 one-time" |
| 2 | AI-search audit sells $25-$99 on Upwork | VERIFIED | upwork.com/services/product/marketing-i-will-check-if-your-business-appears-in-chatgpt-and-ai-search-2037836096632486471 · 2026-10-12 · "Tiers run from $25 to $99" |
| 3 | Drop-off consignment 30-35% | VERIFIED | northernexpress.com/news/feature/article-1572-... and valdostadailytimes.com/?p=49612 · 2026-10-12 · "35% on the first $200 of sales" / "30 percent for items selling for $20 to $99" |
| 4 | Spanish translation $57.50/page | VERIFIED | blogs.extension.wisc.edu/oaic/files/2023/02/Estimating-the-cost-of-Language-Access-services_02.28.23.pdf · 2026-10-12 · "$0.23 per word and $57.50 per page" |
| 5 | Care plans $50-$300/mo, social retainers $300-$1,500, Shopify setup, QR menu one-time price | UNVERIFIED | no URL tied in result summaries; E4a, E6, E7, E3c |

## Assumptions
- Every price point in IDEAS.md that is not tagged VERIFIED is a scout test price (ASSUMPTION). No Sacramento-specific price exists in evidence.
- Owner texting/visiting a business is treated as the owner's act gated by an approval ID, not as agent contact.
- I-013..016 assume the owner already has a marketplace login.

## Open risks (for red-team / system-qc)
- All service rows depend on U3 (payment rail) and U6 (who the warm contacts are). If both fail, the honest Lane A first-dollar odds are in I-013..016, whose amounts are UNKNOWN.
- E12: playbook says no build before written yes + logged deposit; SP-2 (preview) is inactive until A-003. I-004 depends on it.
- E13: agents cannot fetch client sites; I-009, I-017, I-019 need owner screenshots/PageSpeed output. Check feasibility.
- Review-request kit (I-010): confirm wording avoids review gating/incentives; I-018: cancellation terms; I-013..015: CDTFA permit question.
- Searches did not cover trade-in payouts (I-016), wholesale demand (I-020), or local menu pricing (I-011). Rated UNVERIFIED, not dropped, per "no idea without a plausible payer".
- Pattern check: FP-01 (owner steps without deadline) — my steps give actions and minutes but no deadlines; red-team to assign. FP-02 (estimated prices) — all service prices are estimates; no build should rest on them.

## Acceptance checklist (T-005 criteria as given in the task)
- [x] (1) Inventory table with UNKNOWN rows — above (U1..U8)
- [x] (2) 20 rows I-001..I-020 with lens, payer/price tags, phone steps, evidence tag; verdict and status "queued"
- [x] (3) No PC, spend over $100, owner-lacking account (marked UNKNOWN), or hard-limit breach; flags in legend
- [x] (4) Spread: services now, the two sites and blueprint, owned items, deposits/prepay, upsells/referrals; 3 contrarian/boring (003, 015, 017)
- [x] (5) Cache written; README index updated

## Self-check
- [x] Every claim tagged
- [x] Only owned files written (IDEAS.md, library/research/, this handoff)
- [x] No hard-gate action taken (no contact, account, spend, publish)
- [x] Under 120 lines
- [x] Cost line filled (token numbers are estimates)

## QUALITY SCORE: 3
Reasons: payer evidence is VERIFIED for only 4 idea types and is vendor-asking-price, not paid-price; every service price point is an assumption; success hinges on U3 and U6 answers I do not have. A 4 needs the owner's answers to unknowns 1, 2, 5, 8 and 10 minutes of Maps screenshots.

## Receiver validation (filled by the receiving agent)
- Input contract met: YES / NO — 
- Independent score: — 
- Action: ACCEPTED / REJECTED (fixes: …)
