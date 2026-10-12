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
