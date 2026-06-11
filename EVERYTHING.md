# EVERYTHING — Dropship OS Complete Compendium

The entire Dropship OS in one file. This consolidates every document in
the repo plus the live business state, so reading this single file gives
complete context. Source documents remain authoritative for their areas:

| Source | Covers |
|---|---|
| `DROPSHIP-OS-MASTER.md` | Business playbook & decision log |
| `dropship-os/CLAUDE.md` | Agent instructions & MCP tool map |
| `stores/spacelift/STATUS.md` | Live store status & changelog |
| `HANDOFF-TO-CLAUDE-AI.md` | Portable context for claude.ai chats |

**Compiled:** 2026-06-11. When source docs change, recompile this file.

---

# PART 1 — Where things stand right now

**The business is restarting on a brand-new store.** On 2026-06-11 the
owner decided to start over rather than fix the original store
("My Store 4", `ft6xi1-n1.myshopify.com`). Shopify storefront previews
were generated (generation `364a3372-3077-4fb9-8851-d85d09758a58`) for
the new concept:

- **Brand:** Spacelift
- **Sells:** space-saving home organizers, pantry/kitchen storage,
  bamboo turntables
- **Audience:** apartment dwellers, small-space living, home cooks,
  declutterers
- **Style:** clean, modern, airy, natural bamboo tones, minimal

**Next milestone:** owner browses the previews, signs up through the
chosen preview's link (this creates the real store with theme and
starter products pre-installed), then the connected shop is switched to
the new store and all docs are repointed to it.

The old store ("My Store 4") is untouched: 1 active product (Bamboo
Lazy Susan Turntable — $0.00, no images, no SKU, no inventory), 0
orders, 0 customers. It will be ignored or closed after the new store
is claimed.

---

# PART 2 — Business playbook (from DROPSHIP-OS-MASTER.md)

## Business snapshot

| Item | Value |
|---|---|
| Brand name | Spacelift |
| Current Shopify store | My Store 4 (`ft6xi1-n1.myshopify.com`) — being replaced |
| Plan / Currency / Country / TZ | Shopify / USD / United States / PDT |
| Contact email | therealmacintosh52@gmail.com |
| Niche | Kitchen & pantry organization — space-saving home goods |
| Lifecycle | Pre-launch, restarting on a new store |

## Launch blockers (apply to whichever store goes live)

1. Every active product priced (no $0.00 products, ever).
2. Product imagery: minimum 5 photos per product (hero on white,
   lifestyle, size reference, detail, packaging).
3. Inventory/fulfillment policy set per variant.
4. Brand name consistent across store name, email sender, socials.
5. Storefront basics: shipping policy, returns policy, contact page,
   about page (also required for ad platform approval).
6. Payments confirmed live, test mode off.

## Product pipeline

Stages tracked as Shopify product tags: `stage:research`,
`stage:testing`, `stage:scaling`, `stage:kill`.

1. **Research** — candidates must solve a visible, annoying problem; be
   hard to price-compare; ship safely (no glass/batteries initially);
   support ≥3× markup.
2. **Validation** — check supplier seller volume, search trend
   direction, competitor ad activity before committing.
3. **Testing** — $10–20/day ad budget per product for 3–5 days; judge
   on cost per checkout-initiated, not just ROAS.
4. **Scaling** — budget +20–30% every 2–3 days, new creative weekly,
   backup supplier sourced.
5. **Kill** — no add-to-carts after ~$50 spend, or margin collapse:
   archive and log why in the decision log.

**Catalog target:** 5–10 active products within 30 days of launch.

## Pricing rules

- Floor: landed cost (product + shipping + payment fees) × 3.
- Charm pricing: .95/.99 under $50; whole numbers above.
- Free-shipping threshold at ~1.8× AOV once order data exists; until
  then bake shipping into price and advertise "free shipping."
- Never discount sitewide >20%; prefer first-order codes (10–15%)
  captured via email signup.
- Monthly supplier cost re-check; reprice anything below 60% gross.

## Fulfillment & suppliers

- Two suppliers per winning product (primary + backup) with cost,
  shipping time, contact recorded.
- Max delivery promise: 12 business days — replace suppliers that
  can't beat it reliably.
- Unfulfilled after 2 business days → same-day supplier escalation.

## Marketing engine

- Creative-first: 3–5 hooks per product (problem-agitation, demo,
  before/after, UGC-style).
- Channel order: organic short-form video → paid social where organic
  showed traction → search ads only after proven demand.
- Email flows: abandoned checkout (1h, 24h), order-confirmation
  expectations-setter, post-delivery review ask.
- Every ad links to a product page, never the homepage.

## Customer service runbook

- **"Where is my order?"** — reply within 12h with tracking and the
  honest delivery window; never guess a date.
- **Damaged/wrong item** — apologize, refund or reship immediately,
  request a photo for the supplier claim; don't require returns on
  low-cost items.
- **Chargeback** — respond within 48h with tracking, delivery
  confirmation, correspondence. Rate >0.7% risks the processor;
  refund proactively over fighting weak cases.

## Outsourcing thresholds (Upwork)

| Role | When | Budget |
|---|---|---|
| Product video editor | After first winning creative | $15–40/video |
| Customer service VA | >15 support emails/day | $5–8/hr |
| Product photographer | When scaling a winner | per-shoot |

## KPI targets

Gross margin ≥60% · Conversion ≥1.5% · AOV ≥$35 · Refunds <5% ·
Chargebacks <0.5% · Support first response <12h. Review Mondays via
Shopify analytics; update the KPI table and decision log.

## Operating cadence

- **Daily (15 min):** orders check, fulfill/escalate, clear inbox.
- **Every 2–3 days:** ad spend vs. kill/scale rules.
- **Weekly (Mon):** KPIs, one new pipeline product, decision log,
  doc updates.
- **Monthly:** supplier cost re-check, prune dead products, re-test
  the niche hypothesis.

## Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-06-11 | Created Dropship OS master doc; niche set to kitchen & pantry organization | Store had one bamboo organizer product; built the system around it |
| 2026-06-11 | Start over with a brand-new store instead of fixing "My Store 4"; previews generated for the Spacelift concept | Owner preferred a clean start; docs will repoint to the claimed store |

---

# PART 3 — Agent instructions (from dropship-os/CLAUDE.md)

Claude sessions in this repo operate the business with three MCP
connections. Always work from live data — never answer about products,
orders, or customers from memory or repo files alone.

## Tool map

**Shopify (`mcp__Shopify__*`)** — `get-shop-info` (context),
`search_products` / `get-product` (browse), `create-product` /
`update-product` / `bulk-update-product-status` (catalog), collection
tools, `list-orders` / `get-order`, `list-customers`,
`get-inventory-levels` / `set-inventory`, `run-analytics-query`
(ShopifyQL, for KPI reviews), `create-discount`, and
`graphql_query` / `graphql_mutation` for anything without a dedicated
tool (metafields, pages, policies, markets…) — validate with
`graphql_schema` / `validate_graphql_codeblocks` first.
`switch-shop` changes the connected store and **revokes the current
token** — use only when deliberately moving to another store.

**Gmail (`mcp__Gmail__*`)** — `search_threads` / `get_thread` (find
support mail), `create_draft` (all outbound — drafts only), label tools
for triage. Triage labels: `dropship/where-is-my-order`,
`dropship/damaged-or-wrong`, `dropship/chargeback`, `dropship/supplier`.

**Upwork (`mcp__Upwork__*`)** — `upwork_search_freelancers`,
`upwork_display_freelancer_profile`, `upwork_prepare_job_post`. Hire
only at the §thresholds above; job posts are drafts for review.

## Standard workflows

- **Daily ops check:** `list-orders` for stale fulfillments → Gmail
  triage per runbook → `search_products` for active products with
  $0.00 price or missing images.
- **Adding a product:** create as draft with full title/description/
  images/SKU and a ≥3× landed-cost price → tag pipeline stage → add to
  collection → activate only when complete.
- **Weekly KPI review:** `run-analytics-query` → update KPI table and
  decision log → commit and push.

## Guardrails

- Email: **drafts only**, never auto-send without explicit standing
  authorization for that category.
- Discounts: never >20%; first-order codes 10–15%.
- Prices: never $0.00 on an active product; never below the 3× floor
  without explicit owner approval.
- Destructive ops (archive, cancel, refund, bulk mutations): confirm
  first, listing exactly what will change.
- Hiring/spend: never commit spend on the owner's behalf.

## Keeping the OS current

Master doc = business-wide truth; `stores/<store>/STATUS.md` = live
per-store state with an append-only changelog. When the live store
diverges from the docs, update both in the same session, commit, push.

---

# PART 4 — Store status (from stores/spacelift/STATUS.md)

**Spacelift** — pre-launch, being migrated to a brand-new store
(see Part 1). State of the outgoing store ("My Store 4") as last
verified live on 2026-06-11:

- Catalog: 1 product — Bamboo Lazy Susan Turntable, ACTIVE, $0.00, no
  images/SKU/inventory/supplier (`stage:research`).
- Orders: 0 lifetime. Customers: 0. All KPIs n/a.
- Suppliers on file: none.

Changelog: 2026-06-11 — status file created; store verified live;
"Spacelift" adopted as brand name; restart-on-new-store decision made.

---

# PART 5 — Handoff protocol (from HANDOFF-TO-CLAUDE-AI.md)

For continuing work in a claude.ai chat without repo/MCP access: paste
`HANDOFF-TO-CLAUDE-AI.md` (or this file) at the start of the chat. That
session should confirm understanding, work from "where things stand"
(Part 1), and assume **no progress beyond what's written**. Anything
requiring live store access (product edits, orders, analytics) routes
back to the repo-connected Claude Code session, and any decisions or
content produced in claude.ai come back here to be committed and
reflected in the docs.
