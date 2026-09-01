# DROPSHIP OS — Master Document

The single source of truth for running this dropshipping business. Every
session, decision, and runbook starts here. Update this file whenever the
business state changes — it is the operating system, not a one-time plan.

**Last updated:** 2026-06-11

---

## 1. Business snapshot (live state)

Live per-store detail lives in `stores/trendlift/STATUS.md`.

| Item | Value |
|---|---|
| Brand name | Trendlift |
| Strategy | Trend-driven seasonal commerce — ride every gift/trend wave |
| Current Shopify store | My Store 4 (`ft6xi1-n1.myshopify.com`) — new branded store pending (previews generated) |
| Plan / Currency / Country / TZ | Shopify / USD / United States / PDT |
| Contact email | [contact email — kept out of this public repo] |
| Active campaign | **Father's Day 2026 (June 21)** — 5 draft products + smart collection live |
| Orders to date | 0 |

**Model:** instead of one fixed niche, the store runs a rolling calendar
of seasonal campaigns plus a weekly trend radar. Winners from each wave
graduate into the evergreen catalog.

---

## 2. ACTIVE CAMPAIGN — Father's Day 2026

Father's Day is **Sunday, June 21, 2026**. Today is June 11: **10 days**.

**The shipping math is the campaign.** Typical dropship delivery is 8–12
business days, so orders placed after ~June 12–13 will not arrive by the
21st unless the supplier ships from US stock. The plan works around that:

| Window | Play |
|---|---|
| Jun 11–12 | Get supplier quotes (US warehouse / fast shipping ONLY), finalize prices at ≥3× landed, add images, activate the 5 products |
| Jun 12–14 | Launch ads + organic with explicit "order by" deadline messaging |
| Jun 15–18 | Shift creative to the late-gift angle: "it ships after Father's Day — print this gift note so there's something to unwrap" (free printable card with every order) |
| Jun 19–21 | Last-call: digital gift cards only |
| Jun 22+ | Post-mortem in the decision log; graduate winners to evergreen; retire the rest |

**Campaign assets in Shopify (created 2026-06-11):**
- Smart collection **"Father's Day Gift Shop"** (`gid://shopify/Collection/469897969913`) — auto-includes any product tagged `fathers-day-2026`
- 5 draft products (vendor Trendlift, tagged `fathers-day-2026`,
  `stage:research`, `price-estimate`): Whiskey Stones Gift Set $24.95 ·
  Wireless Meat Thermometer $39.95 · 14-in-1 Multitool $22.95 · Magnetic
  Tool Wristband $16.95 · Mini Massage Gun $49.95

**Blocking before activation:** real supplier landed costs (replace the
`price-estimate` tag), product images, store payments/policies live.

## 3. TREND RADAR — catching every wave

The permanent system behind "first Father's Day, then all the trends."

### Seasonal campaign calendar (US)

| Campaign | Date | Prep starts (T-30) | Ads start (T-14) |
|---|---|---|---|
| Father's Day | Jun 21, 2026 | (compressed — active now) | now |
| 4th of July | Jul 4, 2026 | overlaps FD — start Jun 15 | Jun 20 |
| Back to School | mid-Aug | Jul 15 | Aug 1 |
| Halloween | Oct 31 | Oct 1 | Oct 17 |
| BFCM | Nov 27–30 | Oct 28 | Nov 13 |
| Christmas | Dec 25 | Nov 10 (ship cutoffs!) | Dec 1 |
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
| Gross margin | ≥60% | n/a (estimates pending supplier quotes) |
| Conversion rate | ≥1.5% | n/a (no traffic) |
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

## 11. Operating cadence

- **Daily (15 min):** orders, fulfill/escalate, inbox; during campaigns
  also check ad deadlines vs. shipping cutoffs.
- **Every 2–3 days:** ad kill/scale review.
- **Weekly (Mon):** KPI review + trend scan + decision log + doc updates.
- **Monthly:** supplier re-check, prune dead products, review calendar
  for the next campaign's T-30 prep date.
