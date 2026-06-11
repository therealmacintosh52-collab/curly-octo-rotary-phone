# Handoff: Dropship OS → Claude (claude.ai)

Self-contained context for continuing this work in a claude.ai
conversation (or any session without access to this repository). Paste
this file, or attach it, at the start of the chat.

**Handoff written:** 2026-06-11 (post-Trendlift pivot)

## What this business is

**Trendlift** — a trend-driven seasonal dropshipping business on
Shopify, run by Claude under owner delegation, documented as "Dropship
OS" in the GitHub repo `therealmacintosh52-collab/curly-octo-rotary-phone`:

```
DROPSHIP-OS-MASTER.md         playbook, campaigns, trend radar, decisions
dropship-os/CLAUDE.md         agent instructions for the MCP tools
stores/trendlift/STATUS.md    live store status + changelog
EVERYTHING.md                 all of the above in one file
HANDOFF-TO-CLAUDE-AI.md       this file
```

Strategy: ride seasonal/gift waves on a rolling calendar (master doc §3)
instead of a fixed niche. Winners graduate to an evergreen catalog.

## Current state (2026-06-11)

- **Active campaign: Father's Day 2026 (Sun June 21 — 10 days away).**
  Standard dropship shipping (8–12 business days) means orders after
  ~June 12–13 miss the day; plan shifts to a printable-gift-note angle
  mid-window, then digital gift cards (master doc §2 timeline).
- Built in the connected store ("My Store 4", `ft6xi1-n1.myshopify.com`):
  smart collection **Father's Day Gift Shop** (tag `fathers-day-2026`)
  and 5 DRAFT products at 3× *estimated* prices, tagged `price-estimate`:
  whiskey stones $24.95, wireless meat thermometer $39.95, 14-in-1
  multitool $22.95, magnetic tool wristband $16.95, mini massage gun
  $49.95.
- **Storefront:** owner chose the MIDDLE preview from the generated
  store designs and needs to claim it via its signup link — that creates
  the real branded store; assets then get rebuilt there.
- 0 orders, 0 customers. No suppliers on file yet. Legacy Bamboo Lazy
  Susan still active at $0.00 — to be archived.

## Immediate priorities (in order)

1. Owner claims the middle preview → new store exists.
2. Supplier quotes for the 5 FD products — US-stock/fast-ship only;
   confirm prices ≥3× real landed cost, remove `price-estimate` tags.
3. Product images (min 5 each) and activation.
4. Policies pages + payments live; archive the Lazy Susan.
5. Launch FD traffic with deadline messaging; prep the printable gift
   note for the late window.
6. June 15: start 4th of July prep (the calendar overlaps).

## Key operating rules

- Pricing floor 3× landed; no activation while `price-estimate` remains.
- Discounts never >20%; first-order codes 10–15%.
- Customer emails: drafts only, human reviews before sending.
- Confirm before refunds, archives, bulk changes, or any spend.
- Test products at $10–20/day for 3–5 days; kill at ~$50 spend with no
  add-to-carts; scale winners +20–30% every 2–3 days.
- Support first response <12h; chargebacks answered <48h.

## Tooling notes

The repo-connected Claude Code session has MCP access to **Shopify**
(full admin), **Gmail** (drafts/labels), and **Upwork** (search/job
drafts). A claude.ai chat may have none of these — route live-store
work back to the repo session, and bring decisions/content produced in
claude.ai back there to be committed and reflected in the docs.

## What to do with this handoff

Confirm understanding, then continue from "Immediate priorities". Do
not assume progress beyond what is written here — verify against live
Shopify data when tools are available.
