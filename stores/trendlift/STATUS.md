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
- [ ] Legacy product handled: Bamboo Lazy Susan (still ACTIVE at $0.00
      from the old concept) — draft or archive it ⚠️
- [ ] Policies pages: shipping, returns, contact, about
- [ ] Shopify Payments confirmed live
- [ ] Printable Father's Day gift-note PDF for the late-gift angle

## Suppliers

None on file yet.

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
