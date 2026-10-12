# T-005 — scout → red-team

**Status:** DELIVERED (resubmission after REJECTED)
**Task:** Asset inventory + 20 Lane A ideas (I-001..I-020) into `ops/IDEAS.md`, with payer evidence and owner phone steps
**Attempt:** 2 of 3
**Cost:** ~120k in / ~14k out tokens est., ~8 min wall, 0 WebSearch (fixes came from repo reads) · model sonnet

## What was done
Read the rejection (`ops/handoffs/T-005-red-team-to-scout.md`), PROTOCOL §1, FP-07, D-013. Re-read each cited repo line with Bash and applied all 11 fixes. Rewrote the inventory with a per-row Source column (no header-level citation). Edited `ops/IDEAS.md` in place. No new claims beyond the repo lines quoted below; the cache file `library/research/lane-a-ideas-2026-10-12.md` is unchanged.

## Fixes applied (11)
- U1 Phil's "25 pages": VERIFIED(README line 7) tag added, inventory row 3.
- U2 Cali Tints "chat" function: VERIFIED(netlify/functions files incl. chat.mjs) added, row 2.
- U3 Upwork connector scope: re-tagged UNVERIFIED(inferred from tool names; not a D-011 read), row 6.
- U4 Investing: rewritten as excluded by scout scope choice; regulatory status UNVERIFIED(not searched), row 9.
- U5 I-016 store credit: UNVERIFIED(trade-in terms not searched) added.
- U6 I-019 Lighthouse: VERIFIED(MASTER-BLUEPRINT.md line 25) added; also tagged its "seen with websites" list to cache line 99.
- M1 "proven": quoted VERIFIED(playbook line 3), row 1.
- M2 I-010: "card printing cost UNKNOWN (E3d covers table tents only, UNVERIFIED)".
- M3 I-001: "price anchor VERIFIED(a1, agency asking price); payer for this segment UNVERIFIED" (payer tag corrected to UNVERIFIED).
- M4 Legend line added to IDEAS.md: minute figures, delivery times and "warm payer" are scout ASSUMPTIONS; "warm" wording replaced in I-005 and I-008 with "relationship and payment UNKNOWN"; I-003 minutes marked ASSUMPTION; top-5 "delivered in hours" and "warm payer" reworded below.
- M5 Inventory table now has a Source column with a tag per row.
Extra (requested): Phil's already-live-site fact folded into I-005's fallback (see below).

## Asset inventory (per-row sources; today 2026-10-12)
| # | Asset | State | Monetize this week | Ideas | Source tag |
|---|---|---|---|---|---|
| 1 | `blueprint/` (3 files) + `library/playbooks/local-site-build.md` | Playbook is proven. Build gate: written agreement + logged deposit | Fixed-price done-for-you sites | I-001,002,004,018,020 | VERIFIED(repo library/playbooks/local-site-build.md line 3, "Status: proven (two sites shipped"); files VERIFIED(repo ops/CONTEXT.md line 21, "MASTER-BLUEPRINT, intake, new-site-prompt"); gate VERIFIED(E12 in cache, playbook, "Spec builds for a pitch are allowed only as a preview with a standing permission (SP-2)") |
| 2 | `sites/cali-tints/` | Complete reference build with Stripe deposit checkout, lead capture, chat assistant, AI-search kit. Paid? UNKNOWN | Live demo on a phone; care plan; add-ons; referrals | I-005,006,007,008 | VERIFIED(repo sites/cali-tints/netlify/functions/, files checkout.mjs, stripe-webhook.mjs, leads.mjs, chat.mjs); paid UNKNOWN per VERIFIED(repo ops/CONTEXT.md line 21, "UNKNOWN: whether either client paid") |
| 3 | `sites/phils-auto-fleet-repair/` | Static Python build, 25 indexable pages, Lodi. Paid or spec: UNKNOWN. Replaces an existing site (see below) | Demo for auto trades; care plan; booking add-on | I-002,005,007 | VERIFIED(repo sites/phils-auto-fleet-repair/README.md line 7, "25 indexable pages"); Lodi VERIFIED(repo ops/CONTEXT.md line 21, "Lodi auto/fleet repair"); replacement VERIFIED(README lines 253-256, "`philsautoandfleetrepair.com` should 301 to `philsautofleet.com`") |
| 4 | AI-search kit (llms.txt, robots allowlist, IndexNow, JSON-LD) | Built into Cali Tints | Standalone audit offer | I-009,017,019 | VERIFIED(E11 in cache, repo sites/cali-tints/public/llms.txt exists; README "JSON-LD, llms.txt, IndexNow") |
| 5 | Prospect list (10 businesses) + exclusion list (8 with sites) | Listing only; has-website UNKNOWN for all 10 | Target set for pitches | I-001,002,009,019 | VERIFIED(repo library/research/income-lanes-2026-10-12.md lines 80-99, "0 businesses confirmed as having no website"; "Excluded because a website WAS seen") |
| 6 | Connectors: Vercel, GitHub, Lovable, Drive, Upwork, Shopify, Zendrop | Listed live; Gmail Forbidden. Upwork seller account UNKNOWN | Builds/previews | all builds | Live/Gmail VERIFIED(repo ops/CONTEXT.md line 24, "Live. Gmail returned Forbidden on 2026-10-12"); Upwork scope UNVERIFIED(inferred from connector tool names upwork_search_freelancers / upwork_display_freelancer_profile / upwork_prepare_job_post; no tool read, names are not a D-011 read) |
| 7 | Trendlift data (19-product research, post-mortem) | Store frozen, $0 revenue, Zendrop $29/mo | Liability; knowledge only; no Lane A row | none | VERIFIED(repo ops/CONTEXT.md line 22, "4 months, $0 revenue ... frozen for arrears, Zendrop $29/mo") |
| 8 | ClipForge | Needs a PC | Not monetizable by a phone-only owner | none | VERIFIED(repo ops/CONTEXT.md line 23, "Local Python/ffmpeg app; needs a PC"); FP-06 in library/failure-patterns.md |
| 9 | Owner skills: reselling, Shopify, investing, content; 3-7 h/week; phone; Elk Grove | Stated | Selling owned items, consignment, local walk-ins. Investing: excluded by scout scope choice; regulatory status UNVERIFIED(not searched) | I-013,014,015 | VERIFIED(repo ops/CONTEXT.md lines 10-13, "Phone-only, no PC"; "3–7 hours/week"; "reselling, Shopify e-commerce, investing, content") |
| U1 | Owned items to sell | UNKNOWN | Drives I-013, I-016 amount | I-013,016 | UNKNOWN(CONTEXT unknown 8, owner-only) |
| U2 | Personal services owner can deliver | UNKNOWN | No service row beyond consignment; an answer would add rows | none yet | UNKNOWN(CONTEXT unknown 8) |
| U3 | Payment rail (Stripe/Square/PayPal/Zelle/Venmo) | UNKNOWN | Blocks every service row's first dollar [PR] | all service rows | UNKNOWN(CONTEXT unknown 2) |
| U4 | Platform logins and cash on hand | UNKNOWN | Blocks I-013..016 | I-013..016 | UNKNOWN(CONTEXT unknown 5) |
| U5 | Business license / DBA; Elk Grove vs Sacramento | UNKNOWN | Invoicing legality check | red-team | UNKNOWN(CONTEXT unknown 4; cache L1..L6) |
| U6 | Existing clients/audience beyond two sites | UNKNOWN | Warm intros would be the fastest first dollar (scout assumption) | I-005,006 | UNKNOWN(CONTEXT unknown 9) |
| U7 | Spanish reader for proofing | UNKNOWN | Needed for I-008 | I-008 | UNKNOWN(not asked in CONTEXT) |
| U8 | Sender identity (phone/email) for outreach | UNKNOWN | Needed before any [OA] step | all [OA] | UNKNOWN(CONTEXT unknown 3) |

## Phil's Auto already has a site (red-team's new fact, applied)
README plans 301s from the old domains, so the repo build is a replacement: VERIFIED(repo sites/phils-auto-fleet-repair/README.md lines 253-256, 2026-10-12, "Every old URL that 404s is ranking thrown away"). That the old site is live today is UNVERIFIED (inferred, no live check). I-005's fallback is now a private offer of the replacement to that one owner [OA], not a walk-in pitch. Payment status stays UNKNOWN.

## Top-5 guess (scout's guess only; red-team decides; all timings and payers are ASSUMPTIONS)
1. I-005 care plan for the two finished sites: zero build, payer UNKNOWN (relationship and payment UNKNOWN, CONTEXT unknown 1); weaker if Phil's was a spec build.
2. I-003 GBP copy-paste pack $99: priced below two VERIFIED agency anchors (E1a, E1b), same-day delivery is an ASSUMPTION, no website needed.
3. I-009 AI-search check $49: VERIFIED market tiers $25-$99 (E5a), uses an existing kit, but agents cannot fetch client sites (E13).
4. I-001 founding-client sites for beauty studios: real prospects but payer UNVERIFIED; needs a Maps check and a payment rail first.
5. I-013 sell-owned-items sweep: fastest possible cash, amount entirely UNKNOWN.

## Evidence (summary; full table in the cache)
| # | Claim | Tag | Source |
|---|---|---|---|
| 1 | GBP setup sells for $250-$750 one-time | VERIFIED | coloradowebimpressions.com/answers/how-much-does-google-business-profile-management-cost · 2026-10-12 · "Setup-only work is $250-$750 one-time" |
| 2 | AI-search audit sells $25-$99 on Upwork | VERIFIED | upwork.com/services/product/marketing-i-will-check-if-your-business-appears-in-chatgpt-and-ai-search-2037836096632486471 · 2026-10-12 · "Tiers run from $25 to $99" |
| 3 | Drop-off consignment 30-35% | VERIFIED | northernexpress.com/news/feature/article-1572-... and valdostadailytimes.com/?p=49612 · 2026-10-12 · "35% on the first $200 of sales" / "30 percent for items selling for $20 to $99" |
| 4 | Spanish translation $57.50/page | VERIFIED | blogs.extension.wisc.edu/oaic/files/2023/02/Estimating-the-cost-of-Language-Access-services_02.28.23.pdf · 2026-10-12 · "$0.23 per word and $57.50 per page" |
| 5 | Agency sites $3,000-$15,000 (asking price) | VERIFIED | jim.com/blog/small-business-website-cost · 2026-10-12 · "most professional builds between $3,000 and $15,000" |
| 6 | Care plans $50-$300/mo, social retainers $300-$1,500, Shopify setup, QR menu one-time price | UNVERIFIED | no URL tied in result summaries; E4a, E6, E7, E3c |

## Assumptions
- Every price point in IDEAS.md not tagged VERIFIED is a scout test price (ASSUMPTION). All minute figures, delivery times and "warm" relationships are scout ASSUMPTIONS (legend line in IDEAS.md).
- Owner texting/visiting a business is the owner's act gated by an approval ID, not agent contact.
- I-013..016 assume the owner already has a marketplace login (CONTEXT unknown 5: UNKNOWN).

## Open risks (for red-team / system-qc)
- All service rows depend on U3 (payment rail) and U6 (warm contacts). If both fail, first-dollar odds sit in I-013..016, whose amounts are UNKNOWN.
- E12: no build before written yes + logged deposit; SP-2 (preview) inactive until A-003. I-004 depends on it.
- E13: agents cannot fetch client sites; I-009, I-017, I-019 need owner screenshots/PageSpeed output.
- Review-request kit (I-010): confirm wording avoids gating/incentives; I-018 cancellation terms; I-013..015 CDTFA permit question.
- Not searched: trade-in payouts (I-016), wholesale demand (I-020), local menu pricing (I-011). Kept UNVERIFIED, not dropped.
- FP-01: owner steps have actions and minutes (ASSUMPTIONS) but no deadlines; red-team to assign. FP-02: service prices are estimates.

## Acceptance checklist (T-005)
- [x] (1) Inventory table with UNKNOWN rows (U1..U8), per-row sources
- [x] (2) 20 rows I-001..I-020, each with lens, payer/price tags, phone steps, evidence tag, status "queued"
- [x] (3) No PC, spend over $100, account the owner lacks (marked UNKNOWN), or hard-limit breach; flags in legend
- [x] (4) Spread: services, the two sites and blueprint, owned items, deposits/prepay, upsells/referrals; contrarian 003, 015, 017
- [x] (5) Cache written; README index updated (attempt 1, unchanged)

## Self-check
- [x] Every claim tagged (IDEAS.md rows and this file re-read once for tags after the edits)
- [x] Only owned files written (IDEAS.md, this handoff)
- [x] No hard-gate action taken
- [x] Under 120 lines
- [x] Cost line filled (token numbers are estimates)

## QUALITY SCORE: 4
Scored on the work per D-013, not on owner unknowns. All 11 defects fixed, with repo-quoted tags and a per-row Source column. Not a 5: payer evidence is still agency asking prices and test prices. "CONTEXT unknown N" counts the checkbox list in ops/CONTEXT.md lines 32-40 in order (1 paid, 2 payment rail, 3 sender, 4 license, 5 platforms, 8 inventory/services, 9 clients); the list has no printed numbers.
