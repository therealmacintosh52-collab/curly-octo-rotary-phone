# LEDGER — every dollar in or out

Sole writer: **auditor**. Last written: 2026-10-12 (T-003). Totals are recomputed from rows, never carried.

## Header

Columns: `date | type | amount | counterparty | stream | source | status`

- **type:** `in` · `out` · `fee` · `refund`
- **amount:** USD. Charges are `out`.
- **status:**
  - `CONFIRMED`: a primary source shows money collected or received. Only these count in totals.
  - `UNCONFIRMED`: a record says billed or claimed; no collection evidence.
  - `PENDING`: not yet collected.
  - `VOID`: canceled, $0 charged. (Added to protocol enum; see Notes.)
  - `UNVERIFIED-LIVE`: figure comes from STATUS.md only; the live tool did not return it. (Added; see Notes.)
- **source:** `[VERIFIED zendrop:<tool> 2026-10-12 "<field>":"<value>"]` for live tool reads. `stores/trendlift/STATUS.md:<line>` where the tool gave nothing.
- **Stream:** `trendlift-dropship` (`stores/trendlift/`). Zendrop store id `3281860`, billed via Shopify `ft6xi1-n1`.

## 1. Zendrop charges (subscription billing)

Live read: `mcp__zendrop__get_billing_subscription_invoices` (limit 20, page 1, total 5). Cross-checked against `stores/trendlift/STATUS.md:51`, which matches the live data.

| date | type | amount | counterparty | stream | source | status |
|---|---|---|---|---|---|---|
| 2026-06-14 | out | 29.00 | Zendrop (billed via Shopify) | trendlift-dropship | [VERIFIED zendrop:get_billing_subscription_invoices 2026-10-12 invoices[id=933872] "status":"billed", "source":"ubb", "description":"Monthly payment: 2026-06-11 - 2026-07-11"] | UNCONFIRMED |
| 2026-07-11 | out | 29.00 | Zendrop (billed via Shopify) | trendlift-dropship | [VERIFIED zendrop:get_billing_subscription_invoices 2026-10-12 invoices[id=969442] "status":"billed", "source":"ubb", "description":"Monthly payment: 2026-07-11 - 2026-08-10"] | UNCONFIRMED |
| 2026-08-10 | out | 0.00 (invoice $29 canceled) | Zendrop (billed via Shopify) | trendlift-dropship | [VERIFIED zendrop:get_billing_subscription_invoices 2026-10-12 invoices[id=1015584] "status":"canceled", "amount":29] | VOID |
| 2026-09-09 | out | 0.00 (invoice $29 canceled) | Zendrop (billed via Shopify) | trendlift-dropship | [VERIFIED zendrop:get_billing_subscription_invoices 2026-10-12 invoices[id=1065462] "status":"canceled", "amount":29] | VOID |
| 2026-10-09 | out | 29.00 | Zendrop (billed via Shopify) | trendlift-dropship | [VERIFIED zendrop:get_billing_subscription_invoices 2026-10-12 invoices[id=1119155] "status":"pending", "amount":29, "description":"Monthly payment: 2026-10-09 - 2026-11-08"] | PENDING |

Tool caveat, quoted from the tool description: "Usage-based (ubb) charges report billed - Shopify or Wix accepted the charge, but neither platform tells Zendrop whether the merchant was actually charged." Jun and Jul are therefore UNCONFIRMED, not paid.

## 2. Zendrop plan (reference, not a charge row)

`mcp__zendrop__get_billing_plan`: `"amount":29`, `"currency":"USD"`, `"ubb_tier":"UBB-20-29"`, `"ubb_tier_summary":"Usage-based plan: up to 20 products for $29 per month."`, `"trial_state":"used"`, `"trial_ends_at":"2026-06-13T23:34:31+00:00"`, `"renewal_date":null`.

Next charge after the pending Oct 9 invoice: **2026-11-08, $29.00 (UNVERIFIED-LIVE)**. Inferred from the pending invoice period end; the plan tool returns `renewal_date: null`.

## 3. Lifetime revenue (live read)

Tool: `mcp__zendrop__get_orders_performance`, store_id `3281860`, date_from `2020-01-01`, date_to `2026-10-12`, date_basis `order_date`.

Quoted from the result:
- `"grossRevenue":{"value":0,"delta":"0%"}`
- `"grossProfit":{"value":0,"delta":"0%"}`
- `"orders":{"fulfilledTotal":0,"delta":"0%","unfulfilled":0,"processing":0,"shipped":0,"delivered":0,"unresolved":0}`
- `"totalUnits":0`, `"refunds":0`, `"discounts":0`
- Scan of the full result for any non-zero revenue, value, amount or total: 0 matches.

| date | type | amount | counterparty | stream | source | status |
|---|---|---|---|---|---|---|
| 2020-01-01 to 2026-10-12 | in | 0.00 | Trendlift store customers | trendlift-dropship | [VERIFIED zendrop:get_orders_performance 2026-10-12 "grossRevenue":{"value":0}] | CONFIRMED (zero) |

Matches `stores/trendlift/STATUS.md:50`: "Orders / revenue / units (lifetime) | 0 / $0 / 0".

## 4. Totals (recomputed from rows)

| metric | value | basis |
|---|---|---|
| Lifetime in | **$0.00** | CONFIRMED rows only |
| Lifetime out | **$0.00** | CONFIRMED rows only. No out row is collected. |
| Lifetime out, UNCONFIRMED (memo, not counted) | $58.00 | Jun $29 + Jul $29, billed |
| Lifetime out, PENDING (memo, not counted) | $29.00 | Oct 9 |
| Net | **$0.00** | in − out, CONFIRMED |
| Net if billed + pending are collected (memo) | −$87.00 | |
| 30-day burn, CONFIRMED | **$0.00** | window 2026-09-12 → 2026-10-12 |
| 30-day exposure, PENDING (memo) | $29.00 | Oct 9 invoice, inside window |
| Recurring run-rate (memo) | $29.00 / month | UBB-20-29 plan |
| Days since start | n/a | no start date in any tool result |
| Time-to-first-dollar | **not started** | no CONFIRMED inflow |
| Revenue per founder-hour | n/a | no revenue to divide |

## 5. BLEED flag

**BLEED: Zendrop subscription, $29/month, stream `trendlift-dropship`.**

Basis: a recurring charge with $0.00 CONFIRMED revenue in the same stream (section 3). Per `.claude/agents/auditor.md` §5, this goes to APPROVALS through the handoff.

APPROVALS line (for the scribe to write into `ops/STATE.md`; auditor does not write that file):

> **A-002** · Cancel Zendrop subscription ($29/mo, UBB-20-29, billed via Shopify on store 3281860). Confirmed revenue on this stream: $0.00 lifetime. Recommended: **YES**. Owner cancels in the Zendrop app; agents cannot. The Oct 9 invoice (1119155, $29) is already PENDING; check cancellation timing before the next cycle (~2026-11-08). Refs D-004. Scope: one-time.

## 6. agent-usage

Rates (API-equivalent $ per MTok in/out, from `ops/CONTEXT.md`): fable $10/$50 · opus $4/$20 · sonnet $2/$10 · haiku $0.10/$0.50.

(No cost rows yet. Per-task cost lines are summed here from handoffs.)

## Notes

- **Status values:** `VOID` and `UNVERIFIED-LIVE` are not in the protocol enum (`ops/PROTOCOL.md` §1, auditor.md method step 2). Orchestrator to ratify or rename.
- **VERIFIED tag:** `ops/PROTOCOL.md` §1 defines VERIFIED as a URL or repo file. Live tool reads are tagged `[VERIFIED zendrop:<tool>]` per auditor.md method step 1. Orchestrator to confirm this extension.
- **Shopify:** not called, per scope. Shopify lifetime orders are therefore not independently checked. The store is frozen per `ops/CONTEXT.md`.
- **Tool output size:** the orders performance result exceeded the tool limit and was saved to a file. The figures above come from Grep on that saved file, with the tool's own JSON keys quoted.
