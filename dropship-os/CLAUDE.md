# Dropship OS — Agent Instructions

You are operating a dropshipping business. The business playbook lives in
[`../DROPSHIP-OS-MASTER.md`](../DROPSHIP-OS-MASTER.md) — read it at the
start of every session. This file tells you **how to execute that playbook
with the connected MCP tools**: Shopify, Zendrop, Gmail, and Upwork.

Always work from live data. Never answer questions about products, orders,
or customers from memory or from this repo — pull current state from the
MCP tools first.

## Store context

- Brand: **Trendlift** — trend-driven seasonal commerce (master doc §1, §3).
- Connected store: **My Store 4** (`ft6xi1-n1.myshopify.com`), Shopify
  plan, USD, PDT. **Frozen by Shopify as of 2026-10-12** — every Admin
  call returns `operation_not_allowed … billing issue`. Only the account
  owner can reactivate (pay outstanding invoices; >30 days frozen also
  means picking a plan). Until then, do not report Shopify state from
  memory; say it is frozen.
- Supplier: **Zendrop**, store id `3281860` (find it again with
  `get_stores`). Usage-based plan $29/mo billed through Shopify.
- Contact email: [contact email — kept out of this public repo]
- Active campaign: none. Father's Day 2026 closed without launch. Q4 plan
  and the three owner decisions that gate it: master doc §2.

## Tool map — which tool for which job

### Shopify (`mcp__Shopify__*`) — the store

| Task | Tool |
|---|---|
| Store details / verify connection | `get-shop-info` |
| Browse or find products | `search_products` |
| Single product details | `get-product` |
| Create / update products | `create-product`, `update-product` |
| Activate/archive in bulk | `bulk-update-product-status` |
| Collections | `create-collection`, `update-collection`, `add-to-collection`, `search_collections`, `get-collection` |
| Orders | `list-orders`, `get-order` |
| Customers | `list-customers` |
| Inventory | `get-inventory-levels`, `set-inventory` |
| Sales/product analytics (KPI reviews) | `run-analytics-query` (ShopifyQL) |
| Discount codes | `create-discount` |
| Anything without a dedicated tool (metafields, pages, policies, markets…) | `graphql_query` / `graphql_mutation` — validate with `graphql_schema` and `validate_graphql_codeblocks` first |

### Zendrop (`mcp__zendrop__*`) — the supplier

| Task | Tool |
|---|---|
| Find the store id | `get_stores` |
| What Zendrop has pushed to / sees in the store | `get_my_products` (status `in_store` / `imported` / `unlinked`), `get_my_product` |
| Browse catalog / find candidates | `get_catalog_trending_products`, `get_catalog_products` (`ships_from: "US"` for US stock; `keyword`, `max_price`) |
| Real cost + variants + images | `get_catalog_product` |
| Real shipping cost + transit to the US | `get_catalog_shipping_estimate` (country `us`) |
| Orders / fulfilment | `get_orders`, `get_order`, `fulfill_order`, `get_tracking_events`, order-issue tools |
| Performance | `get_weekly_performance`, `get_orders_performance` |
| Plan + charges | `get_billing_plan`, `get_billing_subscription_invoices`, `get_billing_invoices`, `get_billing_credit_balance` |
| Push a product to the store | `import_my_product` / `add_my_product` — **only after** the §5 price check passes and the owner has confirmed |

**Landed cost = catalog price + regular US shipping.** Record every quote
in `dropship-os/suppliers/`. Supplier `Amazon Products` (id 417) is an
Amazon relisting priced at retail — it cannot meet §5; say so rather than
pricing it. `Zendrop Fulfillment` (id 13) is China-direct: cheap, 2–3
week transit, state the transit on the product page.

### Gmail (`mcp__Gmail__*`) — customer service & email

| Task | Tool |
|---|---|
| Find support emails | `search_threads`, `get_thread` |
| Reply to customers / supplier outreach | `create_draft` (see guardrails) |
| Inbox triage | `create_label`, `label_thread`, `list_labels` |

Triage labels to use: `dropship/where-is-my-order`,
`dropship/damaged-or-wrong`, `dropship/chargeback`, `dropship/supplier`.
Create them if they don't exist. Answer per the runbook in master doc §7.

### Upwork (`mcp__Upwork__*`) — outsourcing

| Task | Tool |
|---|---|
| Find freelancers (video editors, VAs, photographers) | `upwork_search_freelancers`, `upwork_display_freelancer_profile` |
| Draft a job post | `upwork_prepare_job_post` |

Only hire for roles and at the thresholds defined in master doc §8.

## Standard workflows

### Daily operations check
0. If Shopify returns `operation_not_allowed` / "unavailable for API access", the store is frozen — stop, report, do not retry other Shopify calls.
1. `list-orders` — anything unfulfilled >2 business days → escalate per §5.
2. Gmail `search_threads` for unread support mail → triage, label, draft
   replies per the §7 runbook.
3. `search_products` for `status:active` with price `0.00` or missing
   images → flag as launch blockers.

### Adding a product
1. Pull the real landed cost first: Zendrop `get_catalog_product` +
   `get_catalog_shipping_estimate` (US). Write the quote to
   `dropship-os/suppliers/`. If landed × 3 is above what the market
   pays, stop — do not list it.
2. Create as **draft** with `create-product` (or push via Zendrop so the
   real photos come along): title, description, images, SKU, and a
   price that satisfies the §5 pricing rules (≥3× landed).
3. Tag with pipeline stage (`stage:research` / `stage:testing` …, §3).
4. Add to the relevant collection.
5. Only set `status:active` when price, images, and inventory policy are
   all in place.

### Weekly KPI review (Mondays)
1. `run-analytics-query` for sales, conversion, AOV, refunds.
2. Update the KPI table and decision log in `DROPSHIP-OS-MASTER.md`,
   commit, and push.

## Guardrails

- **Email:** create **drafts** only — never send without the user
  reviewing, unless they have explicitly authorized auto-sending for
  that category of email.
- **Discounts:** never create a discount >20%; first-order codes 10–15%.
- **Prices:** never set or leave a price of $0.00 on an active product;
  never reprice below the §4 floor without explicit user approval.
- **Destructive ops:** archiving products, cancelling orders, refunds,
  bulk mutations, cancelling the Zendrop subscription, or Zendrop
  `cancel_order` — confirm with the user first, listing exactly what
  will change.
- **Hiring:** prepare Upwork job posts as drafts for review; never
  commit spend on the user's behalf.

## Keeping the OS current

`DROPSHIP-OS-MASTER.md` is the single source of truth for business-wide
rules; each store also has a live status file at
`stores/<store>/STATUS.md` (currently `stores/trendlift/STATUS.md`).
When the live store diverges from the docs (new products, first orders,
renamed store, niche pivot), update both in the same session, commit
with a clear message, and push. Append to the store's changelog rather
than rewriting it.
