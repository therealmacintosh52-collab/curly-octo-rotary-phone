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

## FP-09 Federal-only legal read for a California activity
- Where: T-006 red-team gate (`ops/handoffs/T-006-red-team-to-growth.md` row L5) cleared cold texts (A-007..A-009) on the federal TCPA autodialer test alone. It never checked Cal. Bus. & Prof. Code §17538.41, which bans text-message ads to mobile devices except to an existing relationship with an opt-out. T-010 (`library/templates/service-agreement-one-page-2026-10-12.md` l.32) rested the CA automatic-renewal read on a 2018 summary, although AB 2863 amended the law effective 2025-07-01. Found in T-011 (`ops/handoffs/T-011-red-team-to-orchestrator.md`, E1/E4).
- Indicator: a legal row for a California activity cites only federal law, or cites a source older than 6 months, or says "verify with a professional" without naming the CA statute that was searched.
- Fix required: every legal row for a CA activity names the California statute checked (or "none found; searched: <query>") with a dated source under 6 months old. Outreach by text is gated on that row. Red-team's own past PASSes on the same channel are re-gated when a new statute is found.

## FP-10 Pitch copy contradicts the contract it sells
- Where: T-010 audit script (`library/templates/free-growth-audit-2026-10-12.md` l.63) says "No contract" and then sends a one-page agreement. The one-time Starter pitch routes to a text version that reads "$[PRICE]/mo, month-to-month" (agreement l.25). Found by T-011; qa T-012 flagged the second as an advisory.
- Indicator: any price, term, or "no contract / no commitment / cancel anytime" word in a script that is not the same as the governing agreement; or one terms text serving offers with different billing (one-time vs recurring).
- Fix required: qa diffs every price/term word in every script against the agreement before PASS. Each billing type gets its own terms text. A mismatch is a FAIL, not an advisory, because it misstates the deal to a customer.

## FP-11 Recommendation sentence contradicts its own evidence table
- Where: T-009 l.41 (`ops/handoffs/T-009-scout-to-red-team.md`) calls auto repair "the only niche with an owner reference site and a $300+ typical ticket". The same handoff's table gives tint Familiarity 10 and Ticket 6 ($300–$800), and the auto ticket rests on an UNVERIFIED source (cache T5). The superlative carried the go decision. Rejected under D-007 (`ops/handoffs/T-009-red-team-to-scout.md` U4).
- Indicator: "only", "most", "exactly", "best" or "proven" in a recommendation or summary line, with no tag and no row in the table that states it.
- Fix required: every superlative in a recommendation is tagged and checked against the table it summarizes, or deleted. Red-team reads the recommendation line against the table before reading anything else.
