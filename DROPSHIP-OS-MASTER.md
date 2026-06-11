# DROPSHIP OS — Master Document

The single source of truth for running this dropshipping business. Every
session, decision, and runbook starts here. Update this file whenever the
business state changes — it is the operating system, not a one-time plan.

**Last updated:** 2026-06-11

---

## 1. Business snapshot (live state)

| Item | Value |
|---|---|
| Store name | My Store 4 |
| Domain | ft6xi1-n1.myshopify.com |
| Plan | Shopify |
| Currency / Country | USD / United States |
| Timezone | PDT |
| Contact email | therealmacintosh52@gmail.com |
| Active products | 1 |
| Orders to date | 0 |

**Niche (working hypothesis):** kitchen & pantry organization — practical,
problem-solving home goods with broad appeal and low return rates.

### Current catalog

| Product | Price | Inventory | Status | Issues |
|---|---|---|---|---|
| Bamboo Lazy Susan Turntable — Kitchen & Pantry Organizer | $0.00 | 0 | Active | ⚠️ No price set, no SKU, no product image, no inventory |

---

## 2. Immediate priorities (launch blockers)

These must be fixed before spending a dollar on traffic:

1. **Price the Lazy Susan.** Supplier cost + shipping, then apply the
   pricing rules in §4. A $0.00 active product is a live bug.
2. **Add product imagery.** Minimum 5 photos: hero on white, lifestyle
   in-cabinet shot, size reference, spinning detail, packaging.
3. **Set inventory / fulfillment policy.** Either track supplier stock or
   set the variant to "continue selling when out of stock" with a clear
   shipping-time promise.
4. **Rename the store.** "My Store 4" doesn't convert. Pick a brand name
   that fits the kitchen-organization niche and update domain, email
   sender name, and social handles together.
5. **Storefront basics:** shipping policy, returns policy, contact page,
   and an about page. These are also required for ad platform approval.
6. **Payments:** confirm Shopify Payments is active and test-mode is off.

---

## 3. Product pipeline

Every product moves through these stages. Track stage in the product's
tags on Shopify (`stage:research`, `stage:testing`, `stage:scaling`,
`stage:kill`).

1. **Research** — find candidates that solve a visible, annoying problem;
   are hard to price-compare (no strong brand association); ship safely
   (no glass, no batteries to start); and support ≥3x markup.
2. **Validation** — check seller volume on supplier platforms, search
   trend direction, and competitor ad activity before committing.
3. **Testing** — launch with small ad budget ($10–20/day per product,
   3–5 day window). Judge on cost per checkout-initiated, not just ROAS.
4. **Scaling** — winners get budget increases of ~20–30% every 2–3 days,
   new creative variants weekly, and a supplier backup sourced.
5. **Kill** — no add-to-carts after ~$50 spend, or margin collapses after
   real shipping costs: archive the product, write one line in §9 about why.

**Catalog target:** 5–10 active products in the niche within 30 days.
One product is not a store; it's a landing page.

## 4. Pricing rules

- **Floor:** landed cost (product + shipping + payment fees) × 3.
- **Charm pricing:** end in .95 or .99 under $50; whole numbers above.
- **Free shipping threshold:** set at ~1.8× average order value once
  there is order data; until then, bake shipping into the price and
  advertise "free shipping."
- **Discounts:** never run sitewide discounts >20%; prefer first-order
  codes (10–15%) captured via email signup.
- Re-check supplier cost monthly; reprice anything whose margin has
  drifted below 60% gross.

## 5. Fulfillment & suppliers

- Maintain **two suppliers per winning product** — primary and backup,
  with cost, shipping time, and contact recorded per product (Shopify
  metafields or a `suppliers/` directory in this repo).
- Maximum acceptable delivery promise to customer: **12 business days**.
  If a supplier can't beat that reliably, replace them.
- Track orders daily once volume starts: anything unfulfilled after 2
  business days gets escalated to the supplier the same day.

## 6. Marketing engine

- **Creative-first:** the ad creative is the targeting. Produce 3–5 hooks
  per product (problem-agitation, demo, before/after, UGC-style).
- **Channels in order of adoption:** organic short-form video (free
  validation) → paid social on the platform where organic showed traction
  → search ads only after a product has proven demand.
- **Email (Gmail-integrated):** capture emails with the first-order
  discount; minimum flows — abandoned checkout (1h, 24h), order
  confirmation expectations-setter, post-delivery review ask.
- Every ad links to a product page, never the homepage.

## 7. Customer service runbook

Inbox is monitored via the connected Gmail account. Standard responses:

- **"Where is my order?"** — reply within 12h with tracking link and the
  honest delivery window. Never guess a date.
- **Damaged/wrong item** — apologize, refund or reship immediately, ask
  for a photo for the supplier claim. Do not make customers ship returns
  on low-cost items; the return shipping costs more than the product.
- **Chargeback received** — respond with tracking, delivery confirmation,
  and correspondence history within 48h. A chargeback rate >0.7% risks
  the payment processor; refund proactively rather than fight weak cases.

## 8. Outsourcing (Upwork)

Hire only for proven, repeatable work — never to "figure things out":

| Role | When to hire | Budget guide |
|---|---|---|
| Product video editor | After first winning ad creative | $15–40/video |
| Customer service VA | >15 support emails/day | $5–8/hr |
| Product photographer | When scaling a winner | per-shoot |

## 9. KPI dashboard & decision log

Review weekly (Mondays). Pull from Shopify analytics.

| KPI | Target | Current |
|---|---|---|
| Gross margin | ≥60% | n/a (no priced products) |
| Conversion rate | ≥1.5% | n/a (no traffic) |
| Average order value | ≥$35 | n/a |
| Refund rate | <5% | n/a |
| Chargeback rate | <0.5% | n/a |
| Support first-response time | <12h | n/a |

### Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-06-11 | Created Dropship OS master doc; niche set to kitchen & pantry organization | Store had one bamboo organizer product; building the system around it |

---

## 10. Operating cadence

- **Daily (15 min):** check orders, fulfill/escalate, clear support inbox.
- **Every 2–3 days:** review ad spend vs. kill/scale rules (§3).
- **Weekly (Monday):** update KPI table, add one product to the pipeline,
  write decision-log entries, update this document.
- **Monthly:** supplier cost re-check (§4), prune dead products, review
  whether the niche hypothesis still holds.
