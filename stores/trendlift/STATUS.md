# Trendlift — Store Status

Per-store status for **Trendlift** (supersedes the earlier "Spacelift"
concept — see changelog). Updated from live data whenever the store
changes; changelog is append-only. Business-wide rules:
[`../../DROPSHIP-OS-MASTER.md`](../../DROPSHIP-OS-MASTER.md).

**Last verified against live data:** 2026-10-12 (Zendrop live; Shopify
Admin API refused — store frozen, see below)

## Identity

| Item | Value |
|---|---|
| Brand name | Trendlift |
| Strategy | Trend-driven seasonal commerce (master doc §3 calendar) |
| Shopify store | My Store 4 (`ft6xi1-n1.myshopify.com`) — **FROZEN** (Admin API: "shop unavailable for API access … billing issue") |
| Zendrop store id | `3281860` (platform shopify, connection_status 1) |
| Zendrop plan | Usage-based, ≤20 products, $29/month, billed via Shopify; trial used (ended 2026-06-13) |
| Plan / Currency / TZ | Shopify / USD / PDT (as of June; plan state unknown while frozen) |
| Contact email | [contact email — kept out of this public repo] |

## Lifecycle stage

**Dormant / frozen.** No campaign ever launched. Lifetime orders 0,
customers 0, revenue $0. Father's Day 2026 closed without going live
(activation gates were never cleared).

## Live state — 2026-10-12

**Shopify.** Every Admin call returns `operation_not_allowed: This shop is
unavailable for API access. The merchant may need to resolve a billing
issue or upgrade their plan`. Per Shopify's API docs this is the frozen
state (HTTP 402: "The shop is frozen. The shop owner will need to pay the
outstanding balance to unfreeze the shop"). Per Shopify Help, a store
frozen more than 30 days also has to pick a plan and pay the next cycle
on reactivation. Zendrop's Shopify-billed charges were **canceled on
2026-08-10 and 2026-09-09**, which is consistent with the store having
been frozen since early August (≥ 60 days). Nothing in the store can be
read or changed until the owner reactivates it.

**Zendrop** (live). Full quote sheet with landed costs:
`dropship-os/suppliers/zendrop-quotes-2026-10-12.md`.

| Item | Value |
|---|---|
| Products pushed into store by Zendrop (`in_store`) | 9 — 1 wireless thermometer (Amazon relist, $71.36 cost), 1 instant-read thermometer (**no longer in catalog**), 1 massage gun (BeNat, $26.60 landed, 1-day), 1 hammer-hatchet multitool ($28.58 landed, 6-day), 5 licensed NFL/NCAA BBQ sets ($30–66 landed) |
| Store products with no supplier (`unlinked`) | 11 — the 5 FD26 drafts, Galaxy Star Projector, Desk Drawer Organizer, Bamboo Laptop Riser, 3-Tier Rolling Cart, 2× Bamboo Lazy Susan |
| Products clearing the 3× floor at a sellable price | **0 of 9** |
| Orders / revenue / units (lifetime) | 0 / $0 / 0 |
| Subscription charges | Jun $29 billed · Jul $29 billed · Aug canceled · Sep canceled · Oct 9 $29 pending |

**Gmail** connector returned Forbidden on search this session — support
inbox not checked. **Upwork** not needed.

## What the docs said vs. what is true

The June docs recorded "no suppliers on file" and "Zendrop unreachable".
In reality nine Zendrop products were pushed into the store around June
11–13 (store ids `10089467…`–`10089494…`, between the FD drafts and the
Spacelift leftovers), never recorded here, and none are economically
viable under §5. Three Spacelift products were also created *after* the
pivot (mid-June). The Zendrop MCP connector now exists, so supplier cost
and shipping data is readable without the owner's clicks.

## Blockers (in order)

- [ ] **Owner: reactivate the Shopify store** — log in as account owner,
      pay every outstanding invoice (Shopify prompts per invoice; app
      fees from the frozen period count too), and if frozen >30 days
      choose a plan and pay the upcoming cycle. Nothing else can start
      before this. Reference: https://help.shopify.com/en/manual/your-account/frozen-store
- [ ] **Owner: kill-or-commit decision** (see master doc §2). Zendrop
      bills $29/month with zero revenue; if the store stays frozen,
      cancel the Zendrop subscription instead of letting it retry.
- [ ] **Owner: pricing-floor decision** for US-stock Zendrop items
      (3× impossible on Amazon relists) — China-direct, relaxed floor,
      or another supplier network. Details in the quote sheet.
- [ ] Once unfrozen: archive/delete the 9 Zendrop pushes and the
      Spacelift leftovers (destructive — list first, confirm, then do),
      de-duplicate the Lazy Susan, re-verify policies pages, payments,
      DAD10 discount, navigation.
- [x] BFCM/Christmas candidate sourcing (2026-10-12): 10 China-direct
      items quoted with US shipping + transit —
      `dropship-os/suppliers/bfcm26-candidates-2026-10-12.md`. 0 clear
      3×, 3 clear ~2× (galaxy projector, Bluetooth sleep-mask headband,
      USB heated eye mask). Blocker is Zendrop's $4.64–$30 per-item US
      shipping. Awaiting the pricing-floor decision above.
- [x] Policies pages, DAD10 discount, navigation, FD gift note, ad
      creative pack — built 2026-06-11 (unverifiable while frozen).

## Suppliers

**Zendrop** is the only supplier with real quotes on file (9 products,
all failing the floor) — `dropship-os/suppliers/zendrop-quotes-2026-10-12.md`.
Non-Amazon US suppliers seen in the Zendrop catalog: BeNat, The Boss
Store, NexoraUSA, Lush Bath, ChromaGroup, Tropical Seas Clothing,
ExactFit Solutions. "Zendrop Fulfillment" (CN) carries the trending
low-cost items. Doba / CJ US warehouse / Spocket remain owner-account
gated (June research).

## KPIs

| KPI | Target | Current (2026-10-12) |
|---|---|---|
| Orders (lifetime) | — | 0 |
| Revenue (lifetime) | — | $0 |
| Gross margin | ≥60% | n/a — no viable product |
| Conversion rate | ≥1.5% | n/a — store frozen, no traffic |
| AOV | ≥$35 | n/a |
| Fixed cost burn | — | $29/mo Zendrop (2 billed, 2 canceled, 1 pending) + Shopify plan arrears |

## Changelog

| Date | Change |
|---|---|
| 2026-06-11 | Status file created as "Spacelift" (kitchen organization concept). Store verified: 1 unpriced product, 0 orders. |
| 2026-06-11 | Owner restarted: new-store previews generated for Spacelift concept. |
| 2026-06-11 | Owner put Claude in charge; strategy pivoted to trend-driven seasonal commerce as **Trendlift**. Spacelift concept superseded; directory renamed. |
| 2026-06-11 | Father's Day 2026 campaign built: smart collection + 5 draft products (est. prices, `price-estimate` tagged). Second preview set generated for the gifts/trends storefront. |
| 2026-06-11 | Owner picked the **middle preview** as the new storefront. Pending: owner signs up through its link → reconnect via `switch-shop` → rebuild FD campaign assets in the new store. |
| 2026-06-11–13 (recorded 2026-10-12) | Nine Zendrop catalog products were pushed into the store (5 licensed BBQ sets, 2 thermometers, hammer hatchet, massage gun) and three Spacelift products re-created. Not logged at the time. |
| 2026-06-21 | Father's Day passed. Campaign never activated: no supplier costs, no real photos, store never went live. **Closed, no launch.** |
| ~2026-08 | Store frozen by Shopify (inferred: Zendrop's Shopify-billed charges canceled 08-10 and 09-09; Admin API refuses as of 10-12). |
| 2026-10-12 | Full live audit via Zendrop MCP + Shopify MCP (refused). First real landed costs recorded; 0/9 products viable at 3×. Docs refreshed; lifecycle set to dormant/frozen; owner decisions queued (reactivate, kill-or-commit, pricing floor). |
| 2026-10-12 | Owner said go ("flick it"). BFCM shortlist built from 100 trending + 4 keyword scans: 10 quoted, 0 at 3×, 3 at ~2×. Zendrop CN→US shipping $4.64–$30.08/item is the structural blocker; transit 8 d. Decision on the floor still with the owner. |
