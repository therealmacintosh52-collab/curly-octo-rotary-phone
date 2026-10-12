# EVERYTHING — Dropship OS Complete Compendium

The entire Dropship OS in one file: every repo document consolidated,
plus live state. Source docs remain authoritative for their areas:

| Source | Covers |
|---|---|
| `DROPSHIP-OS-MASTER.md` | Business playbook, campaigns, trend radar, decision log |
| `dropship-os/CLAUDE.md` | Agent instructions & MCP tool map |
| `stores/trendlift/STATUS.md` | Live store status & changelog |
| `dropship-os/suppliers/zendrop-quotes-2026-10-12.md` | Real landed costs from Zendrop (first on file) |
| `HANDOFF-TO-CLAUDE-AI.md` | Portable context for claude.ai chats |

**Compiled:** 2026-10-12 (recompiled after the live audit: store frozen,
Father's Day closed as no-launch, first real supplier costs). When
source docs change, recompile this file.

---

# PART 1 — Where things stand right now (2026-10-12)

**Claude runs this project** (owner delegated, 2026-06-11). Strategy:
**Trendlift** — trend-driven seasonal commerce on a rolling calendar.

**Reality check.** Four months in: $0 revenue, 0 orders, 0 customers.
The Shopify store **"My Store 4" (`ft6xi1-n1.myshopify.com`) is frozen**
— every Admin API call returns "shop unavailable for API access …
billing issue" (Shopify's 402/frozen state; the account owner must pay
all outstanding invoices, and after 30+ days frozen also pick a plan and
pay the next cycle). Frozen since ~early August by inference: Zendrop's
Shopify-billed $29 charges were canceled on Aug 10 and Sep 9.

**Father's Day 2026 closed without launching** (no supplier costs, no
real photos, store never live). 4th of July, Back to School and
Halloween were skipped.

**Zendrop** (connected, store id `3281860`, usage-based $29/mo, trial
used): nine catalog products were pushed into the store in June and
never recorded — 5 licensed NFL/NCAA BBQ sets, 2 thermometers (one has
since vanished from the catalog), a hammer-hatchet multitool, a massage
gun. Real landed costs $26.60–$71.36; **0 of 9 clear the 3× floor** at
a sellable price; 8 of 9 are "Amazon Products" relists at Amazon retail.
Eleven more store products have no supplier link (the 5 FD drafts, a
star projector, Spacelift leftovers incl. two duplicate Lazy Susans).
Details: `dropship-os/suppliers/zendrop-quotes-2026-10-12.md`.

**Gmail** connector returned Forbidden this session; inbox unchecked.

# PART 2 — Campaign state and the three owner decisions

No active campaign. Before any product work, the owner decides:

1. **Reactivate or close the Shopify store.** If closing, cancel the
   Zendrop subscription so $29/mo stops retrying.
2. **Kill or commit.** Commit = store live by **Oct 24** (BFCM prep T-30
   is Oct 28) with a real test budget ($10–20/day × 3–5 products).
   Miss that and the next honest window is Valentine's 2027 (prep Jan 15).
3. **Pricing floor.** 3× is unreachable on Zendrop: US-stock is Amazon
   relists at retail; China-direct ships to the US at $4.64–$30.08 per
   item (8-day transit). Ten BFCM candidates quoted 2026-10-12: 0 clear
   3×, 3 clear ~2× (galaxy projector, Bluetooth sleep-mask headband,
   USB heated eye mask). Choose: ~2× test, a cheaper-shipping supplier
   (CJ / AliExpress Choice / Spocket), or park.
   `dropship-os/suppliers/bfcm26-candidates-2026-10-12.md`.

If "commit" — BFCM → Christmas 2026:

| Window | Play |
|---|---|
| Oct 12–24 | Shortlist done (3 at ~2×). Owner reactivates; agent archives the 9 Zendrop pushes + Spacelift leftovers (confirm first), re-verifies policies/payments/nav |
| Oct 24–Nov 8 | Push the 3 via Zendrop (real photos), test order to confirm per-order shipping, 3 hooks each, "Holiday Gift Shop" collection (tag `holiday-2026`), order-by Dec 14 on every page |
| Nov 9–12 | Soft launch, $10–20/day per product, judge cost per checkout-initiated |
| Nov 13–26 | Kill at ~$50 with no ATCs; scale winners +20–30%/2–3 days; BFCM offer ≤20% |
| Nov 27–30 | BFCM; Christmas order-by date = Dec 25 − quoted transit − 3 days, on every page |
| Dec 1–cutoff | Christmas push → printable gift-note angle after cutoff → digital gift cards |
| Jan 2027 | Post-mortem; Valentine's prep Jan 15 |

# PART 3 — Trend radar (the permanent system)

## Seasonal calendar (US) — prep at T-30, ads at T-14

4th of July, Back to School, Halloween — skipped 2026 (store frozen) →
**BFCM (Nov 27–30, prep Oct 28 — needs store live by Oct 24)** →
Christmas (Dec 25, prep Nov 10, watch ship cutoffs) → Valentine's
(Feb 14, prep Jan 15) → Mother's Day (May 9 '27, prep Apr 9) →
Father's Day (Jun '27).

## Weekly trend scan (Mondays, with KPI review)

Scan TikTok trending/creative centers, Google Trends breakouts, supplier
bestseller movers. Score: rising not peaked · problem-solving or
giftable · ships fast/safe · ≥3× markup · demo-able in 15 seconds. Add
max ONE candidate/week as draft (`stage:research`, `trend:<name>`); log
every add/kill.

# PART 4 — Business playbook (rules)

**Pipeline stages** (product tags): `stage:research` → validation →
`stage:testing` ($10–20/day, 3–5 days, judge cost-per-checkout-initiated)
→ `stage:scaling` (+20–30% budget per 2–3 days, creative weekly, backup
supplier) → `stage:kill` (no ATCs after ~$50 spend, archive + log).

**Pricing:** floor = landed cost × 3; charm .95/.99 under $50;
free-shipping threshold ~1.8× AOV once data exists; sitewide discounts
never >20%; first-order codes 10–15%; monthly supplier re-check, reprice
under 60% gross; `price-estimate` products may NOT be activated.

**Fulfillment:** two suppliers per winner; ≤12 business-day promise
(event date is the real ceiling near holidays — use US stock);
unfulfilled >2 days → same-day escalation.

**Marketing:** creative-first, 3–5 hooks per product; organic short-form
→ paid social → search; ads land on product/campaign pages, never the
homepage; email flows: abandoned checkout 1h/24h, expectations-setter,
review ask, plus gift-deadline blasts in season.

**Support:** first response <12h; "where's my order" gets tracking +
honest window (+ printable gift note in gift season); damaged = instant
refund/reship, no return required on low-cost items; chargebacks
answered <48h, refund weak cases (>0.7% rate risks the processor).

**Outsourcing (Upwork):** video editor after first winning creative
($15–40/video); support VA at >15 emails/day ($5–8/hr); photographer
when scaling. Job posts are drafts; never commit spend.

**KPI targets:** margin ≥60% · conversion ≥1.5% · AOV ≥$35 · refunds
<5% · chargebacks <0.5% · first response <12h.

**Cadence:** daily 15-min ops check; ad review every 2–3 days; Monday
KPI + trend scan + decision log; monthly supplier/calendar review.

# PART 5 — Agent instructions (tooling)

Work from live data only. **Zendrop (supplier):** `get_stores` → store id; `get_my_products` (in_store / unlinked); `get_catalog_products` (`ships_from: US`) / `get_catalog_trending_products`; `get_catalog_product` + `get_catalog_shipping_estimate` (us) = landed cost, record in `dropship-os/suppliers/`; billing via `get_billing_plan` / `get_billing_subscription_invoices`; `import_my_product` only after the price check and owner confirmation. Supplier "Amazon Products" cannot meet the 3× floor. **Shopify:** if a call returns `operation_not_allowed` / "unavailable for API access" the store is frozen — stop and report. `search_products`/`get-product`,
`create-product`/`update-product` (drafts until complete),
`list-orders`/`get-order`, `set-inventory`, `run-analytics-query` for
KPIs, `create-discount`, `graphql_query`/`graphql_mutation` for anything
else (validate first). `switch-shop` revokes the current token — only
for deliberate store moves. **Gmail:** `search_threads`/`get_thread`,
`create_draft` (drafts ONLY — never auto-send), triage labels
`dropship/where-is-my-order`, `dropship/damaged-or-wrong`,
`dropship/chargeback`, `dropship/supplier`. **Upwork:**
`upwork_search_freelancers`, `upwork_prepare_job_post` (drafts).

**Guardrails:** no $0.00 active products; no sub-floor prices without
owner approval; no discounts >20%; confirm destructive ops (archive,
cancel, refund, bulk, cancelling the Zendrop subscription) before
running; never commit spend.

**Docs discipline:** master doc = business truth;
`stores/trendlift/STATUS.md` = live store state (append-only changelog);
update both + recompile EVERYTHING.md when reality diverges; commit and
push same session.

# PART 6 — Handoff protocol

For claude.ai chats without repo/MCP access: paste `HANDOFF-TO-CLAUDE-AI.md`
or this file. Assume no progress beyond what's written here; route
live-store actions back to the repo-connected session; bring decisions
and content back to be committed.
