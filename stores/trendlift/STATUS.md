# Trendlift — Store Status

Per-store status for **Trendlift** (supersedes the earlier "Spacelift"
concept — see changelog). Updated from live Shopify data whenever the
store changes; changelog is append-only. Business-wide rules:
[`../../DROPSHIP-OS-MASTER.md`](../../DROPSHIP-OS-MASTER.md).

**Last verified against live store:** 2026-06-11

## Identity

| Item | Value |
|---|---|
| Brand name | Trendlift |
| Strategy | Trend-driven seasonal commerce (master doc §3 calendar) |
| Shopify store | My Store 4 (`ft6xi1-n1.myshopify.com`) — branded replacement pending (preview generation `f4a41235-3dc8-4695-8dc3-a2522708a624`) |
| Plan / Currency / TZ | Shopify / USD / PDT |
| Contact email | therealmacintosh52@gmail.com |

## Lifecycle stage

**Pre-launch, campaign-first.** Active campaign: Father's Day 2026
(June 21). Zero orders, zero customers.

## Active campaign — Father's Day 2026

- Smart collection: **Father's Day Gift Shop**
  (`gid://shopify/Collection/469897969913`), rule `tag = fathers-day-2026`
- Order-by cutoff for standard shipping: ~June 12–13; late-gift angle after

| Product | SKU | Est. price | Status | Gate to activate |
|---|---|---|---|---|
| Whiskey Stones Gift Set | FD26-WSK-01 | $24.95 | Draft | supplier cost + images |
| Wireless Meat Thermometer | FD26-THM-02 | $39.95 | Draft | supplier cost + images |
| 14-in-1 Pocket Multitool | FD26-MLT-03 | $22.95 | Draft | supplier cost + images |
| Magnetic Tool Wristband | FD26-MAG-04 | $16.95 | Draft | supplier cost + images |
| Mini Massage Gun | FD26-MSG-05 | $49.95 | Draft | supplier cost + images |

All five carry `price-estimate` — prices are 3× *estimated* landed cost
and must be confirmed against real supplier quotes before activation.

## Launch blockers (store-wide)

- [ ] Claim new branded store from previews (or rebrand current store) —
      owner decision
- [ ] Supplier quotes for the 5 FD products (US-stock/fast-ship only)
- [ ] Product images for all 5 (min 5 each)
- [x] Legacy product handled: Bamboo Lazy Susan set to DRAFT (2026-06-11,
      after owner reconnected Shopify) — no more $0.00 active product
- [x] Shopify re-authorization — owner reconnected 2026-06-11; still
      store "My Store 4". **Decision: run Father's Day on the current
      store; new-store/rebrand revisited after the campaign**
- [ ] Supplier quotes — shopping list ready:
      `dropship-os/suppliers/fd26-sourcing-list.md` (max landed costs +
      per-quote checklist; owner needs platform accounts to pull quotes)
- [x] Policies pages: About, Shipping Policy, Refunds & Returns created;
      Contact rewritten (2026-06-11). Note: official Settings→Policies
      slots couldn't be set via API (missing `write_legal_policies`
      scope) — owner should paste the page text there or link the pages
      in footer navigation
- [x] First-order discount: **DAD10** — 10%, all customers, active
      (gid://shopify/DiscountCodeNode/1525905064185)
- [ ] Footer/menu links to the new pages (owner: Online Store →
      Navigation, or tell Claude to do it via menu API)
- [ ] Shopify Payments confirmed live
- [x] Printable Father's Day gift-note for the late-gift angle —
      `dropship-os/assets/fathers-day-gift-note.html` (letter landscape,
      fold-in-half card)

## Suppliers

None on file yet. Candidate platforms for US-stock fast shipping
(researched 2026-06-11, quotes require accounts): Doba (US warehouses,
no MOQ — has whiskey-stone suppliers incl. ROCKS brand), CJ Dropshipping
US warehouse, AliExpress US-warehouse filter. Real landed costs must be
quoted before any FD product activates.

## KPIs

| KPI | Target | Current |
|---|---|---|
| Orders (lifetime) | — | 0 |
| Gross margin | ≥60% | n/a |
| Conversion rate | ≥1.5% | n/a |
| AOV | ≥$35 | n/a |

## Changelog

| Date | Change |
|---|---|
| 2026-06-11 | Status file created as "Spacelift" (kitchen organization concept). Store verified: 1 unpriced product, 0 orders. |
| 2026-06-11 | Owner restarted: new-store previews generated for Spacelift concept. |
| 2026-06-11 | Owner put Claude in charge; strategy pivoted to trend-driven seasonal commerce as **Trendlift**. Spacelift concept superseded; directory renamed. |
| 2026-06-11 | Father's Day 2026 campaign built: smart collection + 5 draft products (est. prices, `price-estimate` tagged). Second preview set generated for the gifts/trends storefront. |
| 2026-06-11 | Owner picked the **middle preview** as the new storefront. Pending: owner signs up through its link → reconnect via `switch-shop` → rebuild FD campaign assets in the new store. |
