# Zendrop — real landed costs on file (pulled 2026-10-12)

First real supplier quotes in the project. Pulled live through the Zendrop
MCP connector (store id `3281860`, "My Store 4"). Landed = Zendrop product
cost + Zendrop "regular" shipping to a US address. Fees (Shopify Payments
~2.9% + 30¢) are not included; add ~$1–2 per order when pricing.

**Verdict in one line:** none of the nine products Zendrop has pushed into
the store can clear the §5 pricing floor (landed × 3) at a price customers
would pay. Eight of nine are "Amazon Products" or other US relistings
priced at or above Amazon retail.

## Products Zendrop has pushed into the store (`in_store`)

| Zendrop id | Product | Supplier (country) | Cost | US ship | Days | **Landed** | 3× floor | Market retail | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| 2407630 | BtcLink wireless meat thermometer (1 probe) | Amazon Products (US) | $71.36 | $0.00 | n/a | **$71.36** | $214 | $25–45 | FAIL |
| 2406946 | Instant-read digital meat thermometer | — | — | — | — | — | — | — | **Gone** — no longer in the Zendrop catalog ("Product not found") |
| 1631414 | Muscle Massage Gun (4 heads, 6 speeds) | BeNat (US) | $19.80 | $6.80 | 1 | **$26.60** | $79.80 | $25–40 | FAIL at 3×; ~47% gross at $49.95 |
| 1913968 | 12-in-1 hammer hatchet multitool | The Boss Store (US) | $20.64 | $7.94 | 6 | **$28.58** | $85.74 | $20–35 | FAIL |
| 2474129 | NFL Broncos 2-pc BBQ tool set | Amazon Products (US) | $31.24 | $6.99 | n/a | **$38.23** | $114.69 | ~$25–35 | FAIL |
| 2501274 | NFL Commanders 3-pc tailgater BBQ set | Amazon Products (US) | $65.57 | $0.00 | n/a | **$65.57** | $196.71 | ~$40–60 | FAIL |
| 2492403 | NFL Steelers apron + chef hat | Amazon Products (US) | $29.00 | $6.99 | n/a | **$35.99** | $107.97 | ~$25–35 | FAIL |
| 2482598 | NCAA Penn State 2-pc BBQ tool set | Amazon Products (US) | $23.39 | $6.99 | n/a | **$30.38** | $91.14 | ~$25–35 | FAIL |
| 2505040 | NFL Texans 3-pc tailgater BBQ set | Amazon Products (US) | $35.91 | $6.99 | n/a | **$42.90** | $128.70 | ~$35–50 | FAIL |

"Market retail" for the licensed BBQ sets is an estimate from the Zendrop
cost itself (Amazon relistings sit at or above Amazon's own price); verify
against the live Amazon listing before quoting it anywhere. The
thermometer and massage-gun ranges are from the June WebSearch pass.

Shipping estimates with `estimated_delivery: null` are Amazon-relist items;
Zendrop does not publish a transit time for them.

## Store products Zendrop sees but cannot fulfil (`unlinked`)

These exist in Shopify but are not linked to any Zendrop catalog item, so
an order for any of them has no supplier:

- The five FD26 drafts: Whiskey Stones Gift Set, Wireless Digital Meat
  Thermometer, 14-in-1 Pocket Multitool, Magnetic Tool Wristband, Mini
  Massage Gun (store ids `100891301…`–`100891311…`)
- Galaxy Star Projector (astronaut night light), store id `10089503817977`
- Spacelift leftovers created mid-June (after the pivot): Desk Drawer
  Organizer Set, Bamboo Laptop Riser, 3-Tier Slim Rolling Cart, and TWO
  Bamboo Lazy Susan listings (`10088682193145` and `10093310968057`)

## What this means for pricing policy

The US-stock side of Zendrop's catalog is dominated by "Amazon Products"
relistings whose cost equals Amazon retail. A 3× floor is arithmetically
impossible on those. Real choices:

1. **China-direct via "Zendrop Fulfillment" (CN).** Trending-catalog costs
   run $0.50–$13 (e.g. fireproof document bag $11.45, Bluetooth sleep-mask
   headband $5.66, travel watch case $10.83, fingerprint padlock $11.83).
   3× is easy; transit is 2–3 weeks, so it only works outside hard
   gift deadlines (fine for BFCM orders shipping before Christmas, not
   for a last-week-of-December promise).
2. **Keep US-stock but relax the floor to ~2× for that tier** (owner
   decision — it violates §5 as written). Only the BeNat massage gun
   gets close to viable even then.
3. **Different supplier network** for US-stock (Doba, CJ US warehouse,
   Spocket) — still owner-account gated; see `fd26-sourcing-list.md`.

## Account facts (same pull)

- Zendrop plan: usage-based, up to 20 products, **$29/month**, billed
  through Shopify. Free trial already used (ended 2026-06-13).
- Subscription invoices: 2026-06-14 $29 billed · 2026-07-11 $29 billed ·
  2026-08-10 $29 **canceled** · 2026-09-09 $29 **canceled** · 2026-10-09
  $29 **pending**. ("billed" = Shopify accepted the charge; whether the
  card was actually charged is only visible in Shopify billing.)
- Order/fulfilment invoices: none. Credit balance: $0.
- Orders through Zendrop, lifetime: **0**. Revenue: $0.
