# Failure patterns — how plans die in this org (red-team is the sole writer; append-only)

Each entry: pattern · where it happened · leading indicator · the fix that is now required before PASS.

## FP-01 Sourcing gated on owner clicks that never happen
- Where: Trendlift Father's Day 2026 (`DROPSHIP-OS-MASTER.md` §2 post-mortem). Campaign built, never launched; supplier costs needed the owner to click through an app.
- Indicator: a plan step reads "owner does X in app" with no date and no fallback.
- Fix required: every owner step has an exact phone action, a time estimate, and a deadline; the plan states what happens if it is missed.

## FP-02 Estimated prices treated as real
- Where: 5 FD26 drafts priced at "estimated 3×" (`price-estimate` tag); real quotes four months later showed 0 of 19 products viable.
- Indicator: any price, cost, or conversion number without a VERIFIED tag feeding a go decision.
- Fix required: no build on UNVERIFIED unit economics. Red-team FAILs it.

## FP-03 Structural cost ignored until late
- Where: Zendrop China-direct US shipping $4.64–$30.08 per item broke the 3× floor on everything under ~$40 (`dropship-os/suppliers/bfcm26-candidates-2026-10-12.md`).
- Indicator: margin math that omits shipping, fees, returns, or payment processing.
- Fix required: landed cost = product + shipping + fees + expected refunds, shown line by line.

## FP-04 Work done but not logged for months
- Where: 9 Zendrop products pushed in June 2026, recorded October 2026 (`stores/trendlift/STATUS.md`).
- Indicator: any action without a same-session LOG row.
- Fix required: scribe logs every handoff the session it happens; system-qc flags unlogged actions as incidents.

## FP-05 Fixed cost with zero revenue left running
- Where: Zendrop $29/mo billed/retrying since June 2026 against $0 revenue.
- Indicator: auditor BLEED flag.
- Fix required: any recurring charge in a stream with no CONFIRMED revenue goes to APPROVALS for cancel/keep within one session.

## FP-06 Tool built for a platform the owner cannot use
- Where: ClipForge requires a PC; owner is phone-only.
- Indicator: deliverable requires hardware, software, or hours the owner does not have.
- Fix required: red-team checks every deliverable against CONTEXT.md "Owner" constraints.

## FP-07 Blanket citation standing in for per-claim tags
- Where: T-005 asset inventory (`ops/handoffs/T-005-scout-to-red-team.md`). The header "(source: ops/CONTEXT.md)" covered rows whose facts are not in CONTEXT.md ("25 pages", "chat functions", "proven", "Investing = regulated advice"). In IDEAS I-001, "payer VERIFIED(cache a1)" sat on a source that shows only agency asking prices. Rejected by red-team 2026-10-12 (`ops/handoffs/T-005-red-team-to-scout.md`). Cost: one round-trip, with growth's Day-1 plan delayed.
- Indicator: one source named in a table header or section lead for many rows; or a VERIFIED tag whose quoted text does not itself state the claim it is attached to.
- Fix required: a tag on each row, with the quote that states the claim. A blanket source is valid only if every fact in the block appears in it. Red-team checks at least 3 repo-cited claims per handoff against the repo before accepting.

## FP-08 Reviewer's first-pass sweep misses defects, which surface on re-review
- Where: T-006 attempt 2 (`ops/handoffs/T-006-red-team-to-growth.md`, Input validation). Red-team's attempt-1 rejection of T-005 listed 11 defects but missed 3 untagged phrases in rows the fix list did not touch: I-009/I-019 "pagespeed.web.dev (no login)", I-016 "in-app instant quotes (no spend)", I-015 "drop-off stores refuse". All three are claims about how a platform or tool behaves. With a 3-attempt cap, finding them late forces a choice: re-reject and spend the last attempt on the reviewer's error, or accept against D-007.
- Indicator: a re-review finds a defect in text the sender says it did not change; or a rejection's fix list skips claims about tool or platform behaviour ("free", "no login", "instant").
- Fix required: a rejection sweeps every row, including tool/platform-behaviour phrases, and states "full sweep done". Defects that predate the rejection and are found later are carried as UNVERIFIED in the receiver's file and logged as a reviewer miss (incident against the reviewer). They block only if they feed a go decision.

## FP-09 Search-tool artifact read as a market signal
- Where: T-008 (`ops/IDEAS.md` I-029 "the search returned 10 gig pages", I-032 "many sellers returned (saturated)", I-040 and cache W5 "10 sellers returned, so supply is crowded"; `ops/handoffs/T-008-scout-to-red-team.md` lines 39, 47). WebSearch returns a list of about 9-10 links per call whatever the market size: red-team's 5 calls on 2026-10-12 returned 10, 9, 9, 10 and 9 links. "10 results" therefore says nothing about how crowded a niche is, and a short list says nothing about how open it is. Rejected by red-team 2026-10-12 (`ops/handoffs/T-008-red-team-to-scout.md`, F1-F4). Cost: part of one round-trip. The risk is ranking ideas up or down on noise.
- Indicator: a result count, "many sellers returned", or "search found few" used as evidence of demand, supply or saturation.
- Fix required: a demand or saturation claim needs a count the platform itself displays, either quoted in a snippet or screenshotted by the owner: review count, "orders in queue", "N services available", sold listings. Otherwise it is tagged UNVERIFIED and gets no weight in the ranking.

## FP-10 Parallel tests that share one blocker are one bet
- Where: Day-1 portfolio (`ops/EXPERIMENTS.md` EXP-A2..A5; condition C1). Four of the five "parallel" tests needed the same unanswered owner questions (A-004 Q2–Q4: payment rail, sender identity, licence; `ops/STATE.md` APPROVALS). On Day 2, 0 of 5 had launched. Found by red-team in T-009 (`ops/handoffs/T-009-red-team-to-growth.md`, portfolio table).
- Indicator: two or more planned tests list the same unanswered A-### / A-004 question under "blocked on".
- Fix required: the portfolio table has a "blocked on" column. At most 2 live-or-planned tests may share one unanswered owner question, unless the plan names a test that runs without it.

## FP-11 Platform clocks left out of time-to-first-dollar
- Where: T-008 (`ops/IDEAS.md` I-021 tagged Lane A; scout S scores for the [NF] rows). Seller approval, listing review and payout holds were never searched (W19), yet they set the speed score. Red-team's T-009 searches (2026-10-12, secondary sources) found: TaskRabbit approval under 4 business days plus a deposit wait of up to 5 days; Upwork Catalog review up to 5 business days plus about a 5-business-day fund security period. Each sits outside a 72 h Lane A window.
- Indicator: a platform-account idea tagged Lane A or "first dollar 72 h"; or a speed score given while approval, review or payout timing is UNVERIFIED.
- Fix required: every platform idea states three clocks (approval/review, first order, payout to bank), each tagged. Until they are known it is Lane B. H72 thresholds count orders or bookings, and the auditor counts money only when it reaches the bank.
