# Handoff: Dropship OS → Claude (claude.ai)

Self-contained context for continuing this work in a claude.ai
conversation (or any session without access to this repository). Paste
this file, or attach it, at the start of the chat.

**Handoff written:** 2026-10-12 (post-audit; store frozen)

## What this business is

**Trendlift** — a trend-driven seasonal dropshipping business on
Shopify, run by Claude under owner delegation, documented as "Dropship
OS" in the GitHub repo `therealmacintosh52-collab/curly-octo-rotary-phone`:

```
DROPSHIP-OS-MASTER.md                         playbook, campaign state, trend radar, decisions
dropship-os/CLAUDE.md                         agent instructions for the MCP tools
stores/trendlift/STATUS.md                    live store status + changelog
dropship-os/suppliers/zendrop-quotes-2026-10-12.md   real landed costs (first on file)
EVERYTHING.md                                 all of the above in one file
HANDOFF-TO-CLAUDE-AI.md                       this file
```

Strategy: ride seasonal/gift waves on a rolling calendar (master doc §3)
instead of a fixed niche. Winners graduate to an evergreen catalog.

## Current state (2026-10-12)

- **Shopify store "My Store 4" (`ft6xi1-n1.myshopify.com`) is FROZEN.**
  Every Admin API call returns "shop unavailable for API access …
  billing issue". Shopify's 402/frozen state: the account owner must pay
  all outstanding invoices; frozen >30 days also means choosing a plan
  and paying the next cycle. Likely frozen since early August (Zendrop's
  Shopify-billed charges were canceled Aug 10 and Sep 9).
- **Father's Day 2026 never launched.** No supplier costs, no real photos,
  store never live. 4th of July, Back to School and Halloween skipped.
- **Zendrop (connected, store id 3281860):** usage-based plan $29/month,
  9 products pushed into the store in June (5 licensed NFL/NCAA BBQ
  sets, 2 thermometers — one now gone from the catalog, a hammer
  hatchet, a massage gun). Real landed costs: $26.60–$71.36. **None can
  hit the 3× floor** at a price anyone pays; 8 of 9 are Amazon relists.
  Lifetime orders 0, revenue $0, credit $0.
- 11 more store products have no supplier link (the 5 FD drafts, a star
  projector, Spacelift leftovers incl. two duplicate Lazy Susans).
- Gmail connector was Forbidden this session — inbox unchecked.

## Immediate priorities (in order)

1. **Owner: reactivate or close the Shopify store.** If closing, cancel
   the Zendrop subscription too (it retries $29 monthly).
2. **Owner: kill or commit.** Commit = store live by **Oct 24** so BFCM
   prep (T-30 = Oct 28) is possible; otherwise the next window is
   Valentine's 2027 (prep Jan 15).
3. **Owner: pricing floor for US-stock.** 3× is impossible on Zendrop's
   Amazon relists. Choose China-direct ("Zendrop Fulfillment", 2–3 week
   transit, $0.50–$13 costs), a relaxed ~2× floor for US-stock, or
   another supplier network.
4. If committing: archive the 9 Zendrop pushes + Spacelift leftovers
   (confirm the list first), shortlist 5 China-direct candidates with
   real landed cost + transit, build the "Holiday Gift Shop" collection,
   soft-launch Nov 9–12, BFCM Nov 27–30, Christmas cutoffs stated per
   item. Full timeline: master doc §2.

## Key operating rules

- Pricing floor 3× landed (pending decision 3 above); no activation
  while `price-estimate` remains; no $0.00 active product.
- Discounts never >20%; first-order codes 10–15%.
- Customer emails: drafts only, human reviews before sending.
- Confirm before refunds, archives, bulk changes, cancellations, or any
  spend (including cancelling the Zendrop subscription).
- Test products at $10–20/day for 3–5 days; kill at ~$50 spend with no
  add-to-carts; scale winners +20–30% every 2–3 days.
- Support first response <12h; chargebacks answered <48h.

## Tooling notes

The repo-connected Claude Code session has MCP access to **Shopify**
(full admin — useless while frozen), **Zendrop** (catalog, costs,
shipping estimates, store products, orders, billing — read works today),
**Gmail** (drafts/labels — returned Forbidden on 2026-10-12; owner may
need to re-allow the tool in the connector settings), **Upwork**
(search/job drafts). A claude.ai chat may have none of these — route
live-store work back to the repo session, and bring decisions/content
produced in claude.ai back there to be committed and reflected in the
docs.

## What to do with this handoff

Confirm understanding, then get the three owner decisions. Do not assume
progress beyond what is written here — verify against live Zendrop and
(once unfrozen) Shopify data when tools are available.
