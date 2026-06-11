# EVERYTHING — Dropship OS Complete Compendium

The entire Dropship OS in one file: every repo document consolidated,
plus live state. Source docs remain authoritative for their areas:

| Source | Covers |
|---|---|
| `DROPSHIP-OS-MASTER.md` | Business playbook, campaigns, trend radar, decision log |
| `dropship-os/CLAUDE.md` | Agent instructions & MCP tool map |
| `stores/trendlift/STATUS.md` | Live store status & changelog |
| `HANDOFF-TO-CLAUDE-AI.md` | Portable context for claude.ai chats |

**Compiled:** 2026-06-11 (recompiled after the Trendlift pivot). When
source docs change, recompile this file.

---

# PART 1 — Where things stand right now

**Claude runs this project** (owner delegated, 2026-06-11). Strategy:
**Trendlift** — trend-driven seasonal commerce. First campaign:
**Father's Day 2026 (Sunday, June 21 — 10 days out)**, then a rolling
calendar of seasonal/trend waves.

**Storefront:** owner reviewed the generated previews and chose **the
middle one** of the Father's Day/trends generation
(`f4a41235-3dc8-4695-8dc3-a2522708a624`). Waiting on the owner to claim
it through its signup link (that creates the real store). Until then,
campaign assets are staged in the connected store "My Store 4"
(`ft6xi1-n1.myshopify.com`). Once claimed: `switch-shop` → verify →
rebuild campaign assets there → repoint all docs.

**Built in Shopify on 2026-06-11:**
- Smart collection **Father's Day Gift Shop**
  (`gid://shopify/Collection/469897969913`), rule: tag `fathers-day-2026`
- 5 DRAFT products, vendor Trendlift, tags `fathers-day-2026` +
  `stage:research` + `price-estimate`:
  Whiskey Stones Gift Set (FD26-WSK-01, $24.95) · Wireless Meat
  Thermometer (FD26-THM-02, $39.95) · 14-in-1 Multitool (FD26-MLT-03,
  $22.95) · Magnetic Tool Wristband (FD26-MAG-04, $16.95) · Mini
  Massage Gun (FD26-MSG-05, $49.95)

**Gates before going live:** real supplier landed costs (replace
`price-estimate`), product images, policies pages, payments live, and
the legacy Bamboo Lazy Susan (still ACTIVE at $0.00) drafted/archived.

# PART 2 — Father's Day 2026 campaign plan

The shipping math is the campaign: dropship delivery runs 8–12 business
days, so standard orders placed after ~June 12–13 miss the 21st.

| Window | Play |
|---|---|
| Jun 11–12 | Supplier quotes (US-stock/fast-ship only), confirm prices ≥3× landed, images, activate products |
| Jun 12–14 | Launch ads + organic with explicit "order by" deadline |
| Jun 15–18 | Late-gift angle: "ships after Father's Day — print this free gift note so there's something to unwrap" |
| Jun 19–21 | Last call: digital gift cards only |
| Jun 22+ | Post-mortem; graduate winners to evergreen; retire the rest |

# PART 3 — Trend radar (the permanent system)

## Seasonal calendar (US) — prep at T-30, ads at T-14

4th of July (Jul 4, prep Jun 15) → Back to School (Aug, prep Jul 15) →
Halloween (Oct 31, prep Oct 1) → BFCM (Nov 27–30, prep Oct 28) →
Christmas (Dec 25, prep Nov 10, watch ship cutoffs) → Valentine's
(Feb 14, prep Jan 15) → Mother's Day (May 9 '27, prep Apr 9) →
Father's Day (Jun '27).

## Weekly trend scan (Mondays, with KPI review)

Scan TikTok trending/creative centers, Google Trends breakouts, supplier
bestseller movers. Score: rising not peaked · problem-solving or
giftable · ships fast/safe · ≥3× markup · demo-able in 15 seconds. Add
max ONE candidate/week as draft (`stage:research`, `trend:<name>`); log
every add/kill.

# PART 4 — Business playbook (rules)

**Pipeline stages** (product tags): `stage:research` → validation →
`stage:testing` ($10–20/day, 3–5 days, judge cost-per-checkout-initiated)
→ `stage:scaling` (+20–30% budget per 2–3 days, creative weekly, backup
supplier) → `stage:kill` (no ATCs after ~$50 spend, archive + log).

**Pricing:** floor = landed cost × 3; charm .95/.99 under $50;
free-shipping threshold ~1.8× AOV once data exists; sitewide discounts
never >20%; first-order codes 10–15%; monthly supplier re-check, reprice
under 60% gross; `price-estimate` products may NOT be activated.

**Fulfillment:** two suppliers per winner; ≤12 business-day promise
(event date is the real ceiling near holidays — use US stock);
unfulfilled >2 days → same-day escalation.

**Marketing:** creative-first, 3–5 hooks per product; organic short-form
→ paid social → search; ads land on product/campaign pages, never the
homepage; email flows: abandoned checkout 1h/24h, expectations-setter,
review ask, plus gift-deadline blasts in season.

**Support:** first response <12h; "where's my order" gets tracking +
honest window (+ printable gift note in gift season); damaged = instant
refund/reship, no return required on low-cost items; chargebacks
answered <48h, refund weak cases (>0.7% rate risks the processor).

**Outsourcing (Upwork):** video editor after first winning creative
($15–40/video); support VA at >15 emails/day ($5–8/hr); photographer
when scaling. Job posts are drafts; never commit spend.

**KPI targets:** margin ≥60% · conversion ≥1.5% · AOV ≥$35 · refunds
<5% · chargebacks <0.5% · first response <12h.

**Cadence:** daily 15-min ops check; ad review every 2–3 days; Monday
KPI + trend scan + decision log; monthly supplier/calendar review.

# PART 5 — Agent instructions (tooling)

Work from live data only. **Shopify:** `search_products`/`get-product`,
`create-product`/`update-product` (drafts until complete),
`list-orders`/`get-order`, `set-inventory`, `run-analytics-query` for
KPIs, `create-discount`, `graphql_query`/`graphql_mutation` for anything
else (validate first). `switch-shop` revokes the current token — only
for deliberate store moves. **Gmail:** `search_threads`/`get_thread`,
`create_draft` (drafts ONLY — never auto-send), triage labels
`dropship/where-is-my-order`, `dropship/damaged-or-wrong`,
`dropship/chargeback`, `dropship/supplier`. **Upwork:**
`upwork_search_freelancers`, `upwork_prepare_job_post` (drafts).

**Guardrails:** no $0.00 active products; no sub-floor prices without
owner approval; no discounts >20%; confirm destructive ops (archive,
cancel, refund, bulk) before running; never commit spend.

**Docs discipline:** master doc = business truth;
`stores/trendlift/STATUS.md` = live store state (append-only changelog);
update both + recompile EVERYTHING.md when reality diverges; commit and
push same session.

# PART 6 — Handoff protocol

For claude.ai chats without repo/MCP access: paste `HANDOFF-TO-CLAUDE-AI.md`
or this file. Assume no progress beyond what's written here; route
live-store actions back to the repo-connected session; bring decisions
and content back to be committed.
