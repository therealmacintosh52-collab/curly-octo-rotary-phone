# LEDGER — every dollar in or out

Sole writer: **auditor**. Last written: 2026-10-12 (T-003b: enum rename, agent-usage, allocation, weekly-review line). Totals are recomputed from rows, never carried.

## Header

Columns: `date | type | amount | counterparty | stream | source | status`

- **type:** `in` · `out` · `fee` · `refund`
- **amount:** USD. Charges are `out`.
- **status** (enum per `ops/PROTOCOL.md` §1, ratified by D-011):
  - `CONFIRMED`: a primary source shows money collected or received. Only these count in totals.
  - `UNCONFIRMED`: a record says billed or claimed; no collection evidence. Also used for a projected charge that has not been billed.
  - `PENDING`: not yet collected.
  - `VOID`: canceled, $0 charged.
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

Next projected charge after the pending Oct 9 invoice: **2026-11-08, $29.00 (UNCONFIRMED)**. This is a projection, not a billed record: inferred from the pending invoice period end; the plan tool returns `renewal_date: null`. Excluded from all totals.

## 3. Lifetime revenue (live read)

Tool: `mcp__zendrop__get_orders_performance`, store_id `3281860`, date_from `2020-01-01`, date_to `2026-10-12`, date_basis `order_date`.

Quoted from the result (T-003, not re-called in T-003b):
- `"grossRevenue":{"value":0,"delta":"0%"}`
- `"grossProfit":{"value":0,"delta":"0%"}`
- `"orders":{"fulfilledTotal":0,"delta":"0%","unfulfilled":0,"processing":0,"shipped":0,"delivered":0,"unresolved":0}`
- `"totalUnits":0`, `"refunds":0`, `"discounts":0`
- Scan of the full result for any non-zero revenue, value, amount or total: 0 matches.

| date | type | amount | counterparty | stream | source | status |
|---|---|---|---|---|---|---|
| 2020-01-01 to 2026-10-12 | in | 0.00 | Trendlift store customers | trendlift-dropship | [VERIFIED zendrop:get_orders_performance 2026-10-12 "grossRevenue":{"value":0}] | CONFIRMED (zero) |

Matches `stores/trendlift/STATUS.md:50`: "Orders / revenue / units (lifetime) | 0 / $0 / 0".

## 4. Totals (recomputed from rows, T-003b)

| metric | value | basis |
|---|---|---|
| Lifetime in | **$0.00** | CONFIRMED rows only (section 3 zero row) |
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

Basis: a recurring charge with $0.00 CONFIRMED revenue in the same stream (section 3). Raised to APPROVALS through the T-003b handoff.

APPROVALS line (for the scribe to write into `ops/STATE.md`; auditor does not write that file):

> **A-002** · Cancel Zendrop subscription ($29/mo, UBB-20-29, billed via Shopify on store 3281860). Confirmed revenue on this stream: $0.00 lifetime. Recommended: **YES**. Owner cancels in the Zendrop app; agents cannot. The Oct 9 invoice (1119155, $29) is already PENDING; check cancellation timing before the next projected cycle (2026-11-08). Refs D-004. Scope: one-time.

## 6. agent-usage

Rates (API-equivalent $ per MTok in/out, `ops/CONTEXT.md` line 28): fable $10/$50 · opus $4/$20 · sonnet $2/$10 · haiku $0.10/$0.50.

**Source:** `ops/METRICS.md`, "Cost detail, session 1" and "By task" (system-qc, session 1). Token counts are agent self-estimates from each handoff Cost line. **All figures below are ESTIMATE.** Dollar figures re-computed by auditor from the METRICS token counts at the rates above; they match METRICS except where noted.

| agent (model) | runs (tokens in / out) | tokens in / out | $ ESTIMATE |
|---|---|---|---|
| scout (sonnet) | T-001 150k/16k; T-005 attempt 2 120k/14k (attempt 1 unrecorded) | 270k / 30k | 0.84 |
| red-team (opus) | T-005 attempt-1 reject 110k/10k; T-006 attempt 2 210k/15k | 320k / 25k | 1.78 |
| growth (sonnet) | T-007 75k/28k | 75k / 28k | 0.43 |
| auditor (haiku) | T-003 30k/5k | 30k / 5k | 0.01 |
| **Metered subagents, subtotal** | | **695k / 88k** | **3.06** |
| Orchestrator (fable) | not metered; session estimate | ~250k / ~20k | ~3.50 |
| system-qc (sonnet) | session check, uncached upper bound | ~350k / ~15k | ~0.85 |
| scribe (haiku) | S1, S1b not metered | n/a | n/a (immaterial) |
| **Session 1 total** | | | **~7.41** (METRICS session row shows 7.40; it uses 0.84 for system-qc) |

Per-task (ESTIMATE):

| task | $ ESTIMATE | basis |
|---|---|---|
| T-001 | 0.46 | scout |
| T-002 | 0.00 | folded into T-006 |
| T-003 | 0.01 | auditor |
| T-005 | 1.02 | scout attempt 2 0.38 + red-team reject 0.64. Scout attempt 1 unrecorded, so this is a lower bound |
| T-006 | 1.14 | red-team attempt 2 |
| T-007 | 0.43 | growth |
| **Done tasks, metered subtotal** | **3.06** | equals the subagent subtotal above (check passes) |
| T-004 | **not attributed** | METRICS by-task line reads "T-004 ~$0.85 (est.)", but no T-004 run appears in the cost detail, and $0.85 equals the system-qc session-check figure. Not counted. Flagged to system-qc (section 9) |

Cost per done task (ESTIMATE): $3.06 / 6 = **$0.51** subagents only; $6.56 / 6 = **$1.09** including Orchestrator estimate. Both match METRICS.

## 7. allocation

Balances as of 2026-10-12. Profit for the period: **$0.00** (no CONFIRMED revenue, section 3–4).

Rule (quoted from `ops/PROTOCOL.md` §7): "Profit = revenue − all costs (ads, tools, fees, COGS, mileage). Weekly order: (1) tax reserve [owner to confirm % with a tax pro; UNKNOWN until then] → (2) operating buffer until one month of operating costs is saved → (3) remainder 50% scale winners / 30% new Lane B/C tests / 20% owner income. No reinvestment before step 2 is met. Lane C never funded from anything but profit. Ratio changes proposed with evidence; owner approves all reallocations."

| # | balance | rule | balance (USD) | status |
|---|---|---|---|---|
| 1 | Tax reserve | 25% of confirmed profit (A-005 placeholder; owner to confirm) | $0.00 | placeholder; A-005 unanswered |
| 2 | Operating buffer | until one month of operating cost is saved (memo target $29.00 = recorded Zendrop run-rate) | $0.00 | **NOT MET** |
| 3 | Scale winners | 50% of remainder after steps 1–2 | $0.00 | gated by step 2 |
| 4 | New tests | 30% of remainder after steps 1–2 | $0.00 | gated by step 2 |
| 5 | Owner | 20% of remainder after steps 1–2 | $0.00 | gated by step 2 |

Gate: step 2 is not met. **Reinvestment is REFUSED** until step 2 is met on CONFIRMED profit. **Lane C spend from anything other than confirmed profit is REFUSED.** No allocation computed around these gates.

## 8. Weekly review

- **Next profit allocation review: 2026-10-19** (Monday).
- **Nothing to allocate.** No CONFIRMED inflow exists (sections 3–4). On 2026-10-19 the auditor recomputes from rows; if no CONFIRMED inflow exists, all five balances stay $0.00 and the review is a no-op.

## 9. Notes

- **Status enum (resolved, D-011):** CONFIRMED / UNCONFIRMED / PENDING / VOID per `ops/PROTOCOL.md` §1. The former non-enum status was renamed UNCONFIRMED in the header and in section 2 on 2026-10-12 (T-003b). The renamed row (projected 2026-11-08 charge) is a projection, not a billed record; it stays excluded from totals.
- **INC-011 (system-qc S1 finding 7):** items closed by this write: enum rename, agent-usage fill, allocation section, weekly-review line. Prevention applied: DECISIONS.md re-read before this write. Verification is system-qc's (PROTOCOL §4 step 4, different agent from fixer).
- **VERIFIED tag (resolved, D-011):** live MCP tool reads are tagged `[VERIFIED zendrop:<tool> <date> "<field>":"<value>"]`.
- **Shopify:** not called, per scope. Shopify lifetime orders are not independently checked. The store is frozen per `ops/CONTEXT.md`. Owner check: A-006.
- **Cost-table anomaly:** T-004 figure (section 6) and system-qc session figure 0.84 vs 0.85 (section 6). Flagged, not corrected in METRICS (system-qc writes it).
- **Tool output size:** the T-003 orders performance result exceeded the tool limit and was saved to a file. Figures in section 3 come from that T-003 read; not re-called in T-003b.
