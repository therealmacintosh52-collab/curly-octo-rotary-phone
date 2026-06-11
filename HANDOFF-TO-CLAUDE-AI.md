# Handoff: Dropship OS → Claude (claude.ai)

Self-contained context for continuing this work in a claude.ai
conversation (or any session without access to this repository). Paste
this file, or attach it, at the start of the chat.

**Handoff written:** 2026-06-11

## What this business is

A dropshipping store on Shopify, brand name **Spacelift** (kitchen &
pantry organization / space-saving home goods). It is run as a documented
system — "Dropship OS" — out of the GitHub repo
`therealmacintosh52-collab/curly-octo-rotary-phone`:

```
DROPSHIP-OS-MASTER.md        ← business playbook: pipeline, pricing,
                                fulfillment, marketing, support, KPIs
dropship-os/CLAUDE.md        ← agent instructions: how to run the
                                playbook with the connected MCP tools
stores/spacelift/STATUS.md   ← live status of the Spacelift store
HANDOFF-TO-CLAUDE-AI.md      ← this file
```

## Current state (verified live on 2026-06-11)

- Shopify store: still named "My Store 4", domain
  `ft6xi1-n1.myshopify.com`, Shopify plan, USD, US, PDT.
  Contact: therealmacintosh52@gmail.com.
- **Pre-launch.** 0 orders, 0 customers.
- Catalog: exactly 1 product — *Bamboo Lazy Susan Turntable — Kitchen &
  Pantry Organizer* — which is ACTIVE but has **no price ($0.00), no
  images, no SKU, no inventory, no supplier on file**.
- No suppliers, no ad accounts in use, no email flows yet.

## Immediate priorities (in order)

1. Get the supplier landed cost for the Lazy Susan and price it at ≥3×
   landed cost (charm pricing: .95/.99 under $50).
2. Add product images (hero, lifestyle in-cabinet, size reference,
   detail, packaging).
3. Set the variant's inventory/fulfillment policy.
4. Rename the store to Spacelift everywhere (store name, sender name).
5. Publish shipping/returns/contact/about pages; confirm Shopify
   Payments is live.
6. Build catalog toward 5–10 products in the niche.

## Key operating rules (from the master doc)

- Pricing floor: 3× landed cost; never discount >20% sitewide.
- Customer delivery promise: ≤12 business days; two suppliers per winner.
- Ad testing: $10–20/day per product, 3–5 days; kill if no add-to-carts
  after ~$50 spend; scale winners +20–30% budget every 2–3 days.
- Support: first response <12h; refund/reship damaged items without
  requiring returns; respond to chargebacks within 48h.
- Email to customers: drafts only, human reviews before sending.
- Confirm with the owner before refunds, archives, bulk changes, or any
  spend.

## Tooling notes

- The Claude Code session attached to the repo has MCP connections to
  **Shopify** (full admin: products, orders, inventory, analytics,
  GraphQL), **Gmail** (search, labels, drafts), and **Upwork** (freelancer
  search, job post drafts). A claude.ai chat may not have these — anything
  requiring live store access should be done in (or handed back to) the
  repo-connected session.
- When work in claude.ai produces decisions or content (product copy, ad
  hooks, brand assets, supplier choices), bring the output back to the
  repo session so it can be committed and the status/master docs updated.

## What to do with this handoff

Read it, confirm understanding of the current state, then continue from
"Immediate priorities". Do not assume any progress beyond what is written
here — verify against live Shopify data when tools are available.
