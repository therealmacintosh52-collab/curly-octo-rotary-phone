# EXPERIMENTS — every live test, with its card set BEFORE launch (scribe is the sole writer; cards come from red-team experiment cards)

Max 3–5 running at once. Kill the moment a threshold is missed; lesson goes to `library/`. Winner = threshold hit → double effort/budget next cycle.

## Launch conditions (red-team T-006, C1–C8)

Copied verbatim from `ops/handoffs/T-006-red-team-to-growth.md` (lines 115–117).

```
VERDICT: PASS-WITH-CONDITIONS (Day-1 plan = EXP-A1..A5)
Conditions (in TASKS.md before launch): C1 A-004 Q2-Q4 answered before any service offer is sent; EXP-A1 can start on Q5/Q8 alone · C2 license held, or A-010 logged, before the first service payment · C3 one personal text per business, none in two lists, stop on no/stop · C4 review wording per card 5, no incentive, no gating · C5 deposit/payment CONFIRMED before any build (E12) · C6 the two sites are "sample builds" unless Q1 confirms clients · C7 subscriptions/prepay: terms shown before payment, affirmative consent, cancel by text · C8 EXP-A1 owned items only, one sweep
Kill criteria (growth/auditor): per-card thresholds at H72 · any card with a missed owner step twice = kill · total cash spend > $25 = pause all · any complaint or "stop" = that business off every list
```

Launch conditions added by red-team T-009 (C9–C15), copied verbatim from `ops/handoffs/T-009-red-team-to-growth.md` (line 115):

```
C9 B1/B2 launch only after the Step D pre-gate passes on platform-displayed counts · C10 C2 extends to platform income: license held or A-010 logged before A-012/A-014 accounts go live · C11 all payment on-platform; no off-app deals with platform customers · C12 listings say "AI-assisted, human-reviewed"; no ranking/result promises (owner reads every GBP/report copy, QA D2) · C13 T-010b D1 fixed before the first GBP delivery; D3/D4 fixed before any review card is sent · C14 B2 assembly only; owner week ≤7 h including tasks · C15 A3 replaces any B slot that fails its pre-gate or live date within 24 h
```

| EXP-### | idea | lane | hypothesis | cost cap ($) | time cap (h) | kill / continue threshold | launched (date, A-### approval) | status (planned/running/killed/winner) | result | lesson → library path |
|---|---|---|---|---|---|---|---|---|---|---|
| EXP-A1 | I-013+I-016 sell owned items | A (lane from IDEAS.md; card has no lane field) | ≤5 owned items listed for local pickup bring ≥$50 cash within 72 h. | $0 | 72 h from first listing | CONTINUE if ≥$50 collected by H72 · one −20% reprice at H48 if <3 buyer messages · KILL if $0 at H72. | pending A-### (see card) | planned | — | — |
| EXP-A2 | I-003 GBP copy-paste pack $99 (+ I-010 $29 add-on line) | A (lane from IDEAS.md; card has no lane field) | ≥1 of 5 Elk Grove businesses with thin Google profiles pays $99 after one personal text. | $0 | 72 h from first send | CONTINUE if ≥1 payment CONFIRMED by auditor by H72 · KILL if 0 paid and ≤1 reply asking details. | pending A-### (see card) | planned | — | — |
| EXP-A3 | I-009 AI-search readiness check $49 | A (lane from IDEAS.md; card has no lane field) | ≥1 of 3 local businesses with websites pays $49 for a one-page AI-search report. | $0 | 72 h from first send | CONTINUE if ≥1 CONFIRMED payment by H72 · KILL if 0. | pending A-### (see card) | shelved (fallback, D-024) | — | — |
| EXP-A4 | I-001+I-018 founding-client site: $450 ($150 deposit) or $590/yr prepaid | A (lane from IDEAS.md; card has no lane field) | ≥1 of 3 Elk Grove lash/nail studios with no Website button pays a deposit or prepay after one text. | $0 cash (builder tokens only after deposit) | 72 h total (D-019: built-in extension capped) | CONTINUE if ≥1 deposit CONFIRMED by H72, or ≥2 replies asking for price/preview (one 48 h extension) · KILL if 0 positive replies at H72. | pending A-### (see card) | planned | — | — |
| EXP-A5 | I-010 review-request QR kit $29 | A (lane from IDEAS.md; card has no lane field) | ≥1 of the 8 EXP-A2/A4 recipients buys the $29 add-on. | $0 (shop prints) | 72 h from the EXP-A2 send | CONTINUE if ≥1 CONFIRMED by H72 · KILL if 0. | pending A-### (see card) | merged into EXP-A2/A4 (D-024) | — | — |
| EXP-B1 | I-030+I-039 Upwork Project Catalog: GBP copy pack $99 + AI-search check $49 | B | two Catalog listings of the QA-passed kits get ≥1 order or ≥2 scope/price messages within 72 h of going live. | $0 cash (no paid Connects or membership; if Upwork asks for money, stop) | 72 h from the first listing going live. Not live by Thu 2026-10-22 20:00 = shelve, slot to A3. | CONTINUE if ≥1 order (funded) or ≥2 buyer messages asking scope/price · KILL if 0 orders and ≤1 message. A dollar counts only when the auditor sees the release in the Upwork balance or bank. | pending A-012..A-015 + Step D pre-check | planned | — | — |
| EXP-B2 | I-021 TaskRabbit Tasker, furniture assembly only, Sacramento/Elk Grove | B | a new assembly Tasker profile gets ≥1 booked task within 72 h of approval and nets ≥$35 from it. | $25 (registration fee, amount UNVERIFIED; if the app shows more than $25, stop) | approval by Wed 2026-10-21 20:00, else KILL (fee lost, ≤$25); then 72 h from approval. | CONTINUE if ≥1 task booked · KILL if 0. A dollar is CONFIRMED only when the deposit shows in the bank. | pending A-012..A-015 + Step D pre-check | planned | — | — |

## Cards, verbatim from red-team T-009 (`ops/handoffs/T-009-red-team-to-growth.md` lines 59–75)

Pre-check shared by B1 and B2 (line 59):

**Step D, demand evidence (TODAY, owner): Wed 2026-10-14 by 12:00, 10 min, no login, no account.** (a) In the phone browser, open taskrabbit.com/locations/sacramento/assemble-furniture and screenshot 3 Tasker cards that show completed-task or review counts. (b) In Upwork (browser), search Project Catalog for "Google Business Profile optimization" and "ChatGPT AI search visibility"; screenshot 3 projects showing review count + price. (c) In the Fiverr app, search "google business profile"; screenshot 3 gigs showing reviews or "orders in queue". If any site asks you to log in, stop and screenshot the login screen; do not create an account. Send everything to growth. Etsy skipped: I-031 failed. Expected $0 directly; a failed gate saves the ≤$25 fee and ~75 owner-min.

**EXP-B1 — I-030+I-039 Upwork Project Catalog: GBP copy pack $99 + AI-search check $49 (Lane B)**
Hypothesis: two Catalog listings of the QA-passed kits get ≥1 order or ≥2 scope/price messages within 72 h of going live.
Pre-gate: launch only if ≥2 of the 6 Step D Upwork/Fiverr screenshots show a platform count of ≥10 reviews or ≥1 order in queue (FP-09). Fail = $0 spent; the slot goes to A3.
Cost cap: $0 cash (no paid Connects or membership; if Upwork asks for money, stop). Time cap: 72 h from the first listing going live. Not live by Thu 2026-10-22 20:00 = shelve, slot to A3.
Kill/continue at H72: CONTINUE if ≥1 order (funded) or ≥2 buyer messages asking scope/price · KILL if 0 orders and ≤1 message. A dollar counts only when the auditor sees the release in the Upwork balance or bank.
Owner steps: (1) Step D, Wed 10-14 12:00, 10 min (2) log A-014 by Wed 20:00, 2 min (3) by Thu 10-15 20:00, 25 min: create the profile from growth's draft, submit both Catalog projects, screenshot "under review" (4) when Upwork asks for a withdrawal method: log A-015 and add the bank, 5 min (5) at H24/H48/H72 after going live, screenshot stats/messages to growth, 1 min each (6) per order: send growth's intake message within 2 h; for AI-check orders, take site screenshots per `library/templates/ai-search-check/README.md` within 24 h (10 min); deliver in Upwork within 24 h of receiving inputs (5 min).
Approvals: A-014, A-015; C2/C10–C13.

**EXP-B2 — I-021 TaskRabbit Tasker, furniture assembly only, Sacramento/Elk Grove (Lane B)**
Hypothesis: a new assembly Tasker profile gets ≥1 booked task within 72 h of approval and nets ≥$35 from it.
Pre-gate: (i) owner answers yes to all three: car for jobs within 15 mi · own drill + level · willing to take an SSN background check; (ii) ≥2 of the 3 Step D Tasker screenshots show ≥25 completed assembly tasks or reviews. If any condition fails, B2 does not launch, $0 is spent and the slot goes to A3. If the page needs a login, (ii) is UNKNOWN and the owner decides at A-012.
Cost cap: $25 (registration fee, amount UNVERIFIED; if the app shows more than $25, stop). Time cap: approval by Wed 2026-10-21 20:00, else KILL (fee lost, ≤$25); then 72 h from approval.
Kill/continue at H72 after approval: CONTINUE if ≥1 task booked · KILL if 0. A dollar is CONFIRMED only when the deposit shows in the bank.
Owner steps: (1) Wed 10-14 by 12:00, 2 min: answer the three pre-gate questions (2) Step D (shared) (3) log A-012 by Wed 20:00, 2 min (4) by Thu 10-15 20:00, 25 min: register in the Tasker app with growth's profile text; assembly category only; rate ≤ the $35/h anchor (growth sets it); pay the fee only if it is ≤$25 and shown before payment (5) when the app asks for a payout account: log A-013 and add the checking account, 5 min (6) after approval, set 2 availability windows; accept a task only if this week's owner minutes plus the task stay ≤7 h (growth tracks this in TODAY.md) (7) the same day as each task, screenshot the earnings line to the auditor, 1 min.
Approvals: A-012, A-013; C2/C10/C11/C14.
