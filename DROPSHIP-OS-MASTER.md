# DROPSHIP OS — Master Document

The single source of truth for running this dropshipping business. Every
session, decision, and runbook starts here. Update this file whenever the
business state changes — it is the operating system, not a one-time plan.

**Last updated:** 2026-10-12 (live audit: Zendrop read, Shopify frozen)

---

## 1. Business snapshot (live state)

Live per-store detail lives in `stores/trendlift/STATUS.md`.

| Item | Value |
|---|---|
| Brand name | Trendlift |
| Strategy | Trend-driven seasonal commerce — ride every gift/trend wave |
| Current Shopify store | My Store 4 (`ft6xi1-n1.myshopify.com`) — **FROZEN by Shopify** (billing); Admin API refuses every call |
| Supplier | Zendrop (store id `3281860`), usage-based plan $29/mo, 9 products pushed, **0 viable at 3×** |
| Plan / Currency / Country / TZ | Shopify / USD / United States / PDT |
| Contact email | [contact email — kept out of this public repo] |
| Active campaign | **None.** Father's Day 2026 closed without launching. Next realistic window: BFCM/Christmas 2026, gated on reactivation by ~Oct 24 |
| Orders / revenue to date | 0 / $0 (verified via Zendrop 2026-10-12) |

**Model:** instead of one fixed niche, the store runs a rolling calendar
of seasonal campaigns plus a weekly trend radar. Winners from each wave
graduate into the evergreen catalog.

**Honest read (2026-10-12):** four months in, the business has generated
$0, paid or been billed ~$58 to Zendrop (two more charges canceled, one
pending), and the storefront is frozen for non-payment. The first
decision in §2 is kill-or-commit, not a product decision.

---

## 2. CAMPAIGN STATE — Father's Day closed; Q4 gated on three owner decisions

### Father's Day 2026 — post-mortem (closed 2026-06-21, no launch)

- Built: smart collection, 5 drafts, policies, DAD10, nav, gift note,
  ad creative. Never cleared the gates: no real supplier costs, no real
  photos, store never live. Zero traffic, zero orders.
- Root cause: sourcing depended on owner clicks in Zendrop that never
  happened, and the agent had no supplier read access. (Fixed since:
  the Zendrop MCP connector is live — see `dropship-os/CLAUDE.md`.)
- Side effect never recorded in June: nine Zendrop products (licensed
  NFL/NCAA BBQ sets, two thermometers, a hammer hatchet, a massage gun)
  were pushed into the store and sit there with Amazon-retail costs.
  Landed costs: `dropship-os/suppliers/zendrop-quotes-2026-10-12.md`.

### Owner decisions required before anything else (in order)

1. **Reactivate or close the Shopify store.** Frozen = pay every
   outstanding invoice as account owner; frozen >30 days = also pick a
   plan and pay the next cycle (Shopify Help: frozen-store page). If the
   answer is close, also cancel the Zendrop subscription so the $29/mo
   stops retrying.
2. **Kill or commit.** Commit means: reactivate by **Oct 24**, accept a
   real test budget (§4: $10–20/day per product × 3–5 products), and
   run BFCM → Christmas as one campaign. Anything later than Oct 24
   misses BFCM prep (T-30 = Oct 28) and the next honest window is
   Valentine's (prep Jan 15, 2027).
3. **Pricing floor.** Zendrop cannot support 3× on either side of its
   catalog: US-stock is Amazon relists at retail, and China-direct
   shipping to the US is **$4.64–$30.08 per item** (quoted 2026-10-12),
   which pushes landed cost past market ÷ 3 on everything under ~$40.
   Transit is a quoted 8 days, so timing is fine; cost is not. Ten
   candidates were quoted: 0 clear 3×, three clear ~2× (galaxy
   projector, Bluetooth sleep-mask headband, USB heated eye mask).
   Options: (a) accept ~2× / 50% gross for a 3-product BFCM test;
   (b) hold 3× and move sourcing to a cheaper-shipping platform
   (CJ / AliExpress Choice / Spocket — owner accounts, not reachable
   here); (c) park. Full sheet:
   `dropship-os/suppliers/bfcm26-candidates-2026-10-12.md`.

### If "commit": BFCM → Christmas 2026 plan

Today is Oct 12. Halloween (Oct 31) is skipped — 19 days out, store
frozen, no viable product.

| Window | Play |
|---|---|
| Oct 12–24 | **Done 2026-10-12:** candidate shortlist with real landed costs + transit (3 viable at ~2×, none at 3×). Still owner-gated: reactivate store; then agent archives the 9 Zendrop pushes + Spacelift leftovers (confirm list first), re-verifies policies/payments/nav |
| Oct 24–Nov 8 | Push the 3 shortlisted via Zendrop (real photos come with them), verify per-order vs per-unit shipping with one test order (bundles only work if per-order), write 3 hooks each, build "Holiday Gift Shop" smart collection (tag `holiday-2026`), order-by date **Dec 14** (Dec 25 − 8 d transit − 3 d buffer) on every page |
| Nov 9–12 | Soft launch: $10–20/day per product, organic short-form, judge cost-per-checkout-initiated |
| Nov 13–26 | Kill at ~$50 spend with no ATCs; scale winners +20–30%/2–3 days; BFCM offer capped at 20% (§5) |
| Nov 27–30 | BFCM. Order-by date for Christmas arrival = Dec 25 minus the supplier's quoted transit minus 3 days buffer — stated on every product page |
| Dec 1–cutoff | Christmas push; switch to "arrives after Christmas — printable gift note" angle once cutoff passes (reuse `dropship-os/assets/` pattern), then digital gift cards |
| Jan 2027 | Post-mortem in the decision log; graduate winners; Valentine's prep Jan 15 |

**Hard gates (unchanged):** no activation with `price-estimate`; no
$0.00 active product; US-stock or stated transit on every page; two
suppliers per winner before scaling.

## 3. TREND RADAR — catching every wave

The permanent system behind "first Father's Day, then all the trends."

### Seasonal campaign calendar (US)

| Campaign | Date | Prep starts (T-30) | Ads start (T-14) |
|---|---|---|---|
| Father's Day | Jun 21, 2026 | — | — (closed, never launched) |
| 4th of July | Jul 4, 2026 | skipped (store frozen) | — |
| Back to School | mid-Aug | skipped (store frozen) | — |
| Halloween | Oct 31 | **skipped** — 19 days out on Oct 12, store frozen | — |
| BFCM | Nov 27–30 | **Oct 28** — needs store live by Oct 24 | Nov 13 |
| Christmas | Dec 25 | Nov 10 (ship cutoffs! CN-direct ~Dec 5, US-stock ~Dec 17) | Dec 1 |
| Valentine's Day | Feb 14, 2027 | Jan 15 | Jan 31 |
| Mother's Day | May 9, 2027 | Apr 9 | Apr 25 |

**Lead-time rule:** supplier + creative prep starts 30 days out; paid
traffic starts 14 days out; messaging switches to last-minute/digital
when the shipping cutoff passes.

### Weekly trend scan (every Monday, with the KPI review)

1. Scan TikTok trending/creative centers, Google Trends breakouts, and
   supplier bestseller movers.
2. Score candidates: rising (not peaked) · problem-solving or strongly
   giftable · ships safely and fast · supports ≥3× markup · demo-able
   in a 15-second video.
3. Add at most ONE trend candidate per week into the pipeline as a
   draft tagged `stage:research` + `trend:<name>`.
4. Log every add/kill in the decision log with one line of reasoning.

## 4. Product pipeline

Stages tracked as Shopify product tags: `stage:research`,
`stage:testing`, `stage:scaling`, `stage:kill`.

1. **Research** — solves a visible problem or is strongly giftable;
   hard to price-compare; ships safely; supports ≥3× markup.
2. **Validation** — supplier seller volume, trend direction, competitor
   ad activity.
3. **Testing** — $10–20/day per product, 3–5 days; judge on cost per
   checkout-initiated, not just ROAS.
4. **Scaling** — budget +20–30% every 2–3 days, new creative weekly,
   backup supplier sourced.
5. **Kill** — no add-to-carts after ~$50 spend or margin collapse:
   archive, one-line decision-log entry.

## 5. Pricing rules

- **Floor:** landed cost (product + shipping + fees) × 3.
- Charm pricing .95/.99 under $50; whole numbers above.
- Free-shipping threshold ~1.8× AOV once data exists; until then bake
  shipping into price, advertise "free shipping."
- Never discount sitewide >20%; first-order codes 10–15% via email capture.
- Monthly supplier re-check; reprice anything under 60% gross.
- Products carrying the `price-estimate` tag may NOT be activated until
  a real supplier landed cost confirms the price.

## 6. Fulfillment & suppliers

- **Zendrop is the connected supplier** (MCP: `mcp__zendrop__*`). Read
  cost + US shipping + transit before any price is set; record every
  quote in `dropship-os/suppliers/`. US-stock "Amazon Products" relists
  cannot meet §5 — see the 2026-10-12 quote sheet.

- Two suppliers per winning product (primary + backup), cost/time/contact
  recorded.
- Max delivery promise 12 business days — for seasonal campaigns the real
  ceiling is the event date; use US-stock suppliers near cutoffs.
- Unfulfilled >2 business days → same-day supplier escalation.

## 7. Marketing engine

- Creative-first: 3–5 hooks per product (problem-agitation, demo,
  before/after, UGC-style). Seasonal campaigns add deadline urgency
  ("order by June 12") and a late-gift fallback.
- Channels: organic short-form video → paid social where organic tracks →
  search ads after proven demand.
- Email flows: abandoned checkout (1h, 24h), order confirmation
  expectations-setter, post-delivery review ask. Seasonal: gift-deadline
  reminder blast to list.
- Every ad links to a product page (or campaign collection), never the
  homepage.

## 8. Customer service runbook

- **"Where is my order?"** — reply <12h with tracking and the honest
  window; never guess a date. During gift campaigns: include the
  printable gift note proactively if delivery will miss the event.
- **Damaged/wrong item** — apologize, refund or reship immediately, photo
  for the supplier claim; no returns required on low-cost items.
- **Chargeback** — respond <48h with tracking + correspondence; >0.7%
  rate risks the processor; refund weak cases proactively.

## 9. Outsourcing (Upwork)

| Role | When to hire | Budget guide |
|---|---|---|
| Product video editor | After first winning creative | $15–40/video |
| Customer service VA | >15 support emails/day | $5–8/hr |
| Product photographer | When scaling a winner | per-shoot |

## 10. KPI dashboard & decision log

Review weekly (Mondays), together with the trend scan.

| KPI | Target | Current |
|---|---|---|
| Gross margin | ≥60% | n/a — 0 of 9 sourced products viable at 3× (2026-10-12) |
| Conversion rate | ≥1.5% | n/a — store frozen, no traffic |
| Average order value | ≥$35 | n/a |
| Refund rate | <5% | n/a |
| Chargeback rate | <0.5% | n/a |
| Support first-response | <12h | n/a |

### Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-06-11 | Created Dropship OS; initial niche kitchen & pantry organization | Built around the store's one bamboo product |
| 2026-06-11 | Start over on a brand-new store; Spacelift previews generated | Owner preferred a clean start |
| 2026-06-11 | **Pivot: owner put Claude in charge; strategy reset to trend-driven seasonal commerce as "Trendlift" — Father's Day 2026 first, then the rolling trend calendar** | Owner direction; FD is 10 days out so campaign-first beats niche-building |
| 2026-06-11 | Built FD campaign: smart collection + 5 draft gift products at estimated 3× prices | Capture the window; activation gated on real supplier costs + images |
| 2026-06-11 | Generated second preview set (Father's Day gifts / trending products, bold masculine style) | Match the storefront to the new strategy |
| 2026-06-11 | Owner chose the MIDDLE preview as the new storefront | "I love the middle website" — owner to claim it via its signup link; store gets rebuilt there once it exists |
| 2026-10-12 | **Father's Day 2026 closed as a no-launch**; 4th of July, Back to School, Halloween skipped | Gates never cleared; store frozen by Shopify since ~Aug (Admin API refuses; Zendrop's Shopify-billed charges canceled Aug/Sep) |
| 2026-10-12 | Recorded the 9 Zendrop products pushed in June and their real landed costs; **all 9 fail the 3× floor** | First real quotes on file; US-stock Zendrop = Amazon relists at retail parity |
| 2026-10-12 | Queued three owner decisions ahead of any product work: reactivate-or-close, kill-or-commit (commit = live by Oct 24 for BFCM), pricing floor for US-stock | $0 revenue in 4 months with fixed costs still accruing; a product decision before these is theatre |
| 2026-10-12 | Zendrop MCP connector adopted as the sourcing channel; June "no autonomous route" finding superseded | Costs, shipping and transit now readable without owner clicks |
| 2026-10-12 | BFCM shortlist quoted (10 China-direct candidates): **0 clear 3×, 3 clear ~2×**. Root cause is Zendrop's $4.64–$30 per-item US shipping, not product cost | §5 floor is unreachable on Zendrop; owner must pick 2×, a cheaper-shipping supplier, or park |

## 11. Operating cadence

- **Daily (15 min):** orders, fulfill/escalate, inbox; during campaigns
  also check ad deadlines vs. shipping cutoffs.
- **Every 2–3 days:** ad kill/scale review.
- **Weekly (Mon):** KPI review + trend scan + decision log + doc updates.
- **Monthly:** supplier re-check, prune dead products, review calendar
  for the next campaign's T-30 prep date.
