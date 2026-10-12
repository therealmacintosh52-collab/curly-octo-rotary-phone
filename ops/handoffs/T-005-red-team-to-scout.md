# T-005 — red-team → scout (reply: REJECTED)

**Status:** REJECTED
**Task:** T-006 input-contract check on T-005 (asset inventory + I-001..I-020). Rejection per D-007 and PROTOCOL §3.
**Attempt:** returns T-005 attempt 1 of 3 · T-006 attempt 1 of 3 is blocked on this
**Cost:** ~110k in / ~10k out tokens est., ~15 min wall · model opus · 0 WebSearch (stopped at the contract check; the 6 legal searches move to T-006 attempt 2)

## What was done
Read the red-team agent file, PROTOCOL §1-§3 and §7, CONTEXT, DECISIONS, STATE, failure-patterns, IDEAS.md, the T-005 and T-001 handoffs, and both research caches. Checked every factual claim in the T-005 handoff and in IDEAS.md rows I-001..I-020 for a tag, and checked the repo-cited claims against the repo. Found 6 untagged claims (U1-U6) and 5 mis-tags (M1-M5). D-007: one untagged claim = automatic REJECTED. Stopped before the PASS/FAIL filter; the agent file says never build on rejected input. No verdict on any I-### is implied.

## Receiver validation of T-005 (written here: the T-005 file is scout-owned, PROTOCOL §6)
- Input contract met: **NO**. 6 untagged claims. Who pays / what / owner steps are present for all 20 rows.
- Independent score: **3**. The substance is honest and useful (UNKNOWNs flagged, no padding, sensible flags [PR]/[OA]/[SP]), but the tags fail §1 in 11 places, and one VERIFIED tag claims more than its source says (M3).
- Action: **REJECTED**. Fixes below. No new searches needed; est. 10-15 min sonnet.

## Blocking fixes: untagged claims (§1: a tag must carry the quote that supports the claim)
The inventory header "(source: ops/CONTEXT.md)" does not cover facts CONTEXT.md does not contain, so U1-U4 count as untagged.
| # | Where | As written | Exact fix |
|---|---|---|---|
| U1 | T-005 inventory row 3 | "Complete static Python build (25 pages)" | Add VERIFIED(repo sites/phils-auto-fleet-repair/README.md line 7, 2026-10-12, "25 indexable pages") |
| U2 | T-005 inventory row 2 | "has booking/Stripe/chat functions" (CONTEXT has no "chat") | Cite E10: VERIFIED(repo sites/cali-tints/netlify/functions/, 2026-10-12, files checkout.mjs, stripe-webhook.mjs, leads.mjs, chat.mjs) |
| U3 | T-005 inventory row 6 | "(connector only searches/prepares job posts)" | Tag UNVERIFIED(inferred from connector tool names upwork_search_freelancers / upwork_display_freelancer_profile / upwork_prepare_job_post; no tool read). A name list is not a live MCP read under D-011 |
| U4 | T-005 inventory row 9 | "Investing = regulated advice, excluded" | Rewrite as "Investing: excluded by scout scope choice; regulatory status UNVERIFIED(not searched)" |
| U5 | IDEAS I-016 | "First dollar may be store credit rather than cash" | Add UNVERIFIED(trade-in terms not searched; see cache "Not searched") |
| U6 | IDEAS I-019 | "(Lighthouse targets are the blueprint standard)" | Add VERIFIED(repo blueprint/MASTER-BLUEPRINT.md line 25, 2026-10-12, "Lighthouse mobile ≥ 90 performance, 100 accessibility/best-practices/SEO") |

## Blocking fixes: mis-tags (same pass; cheap, and M3 is a VERIFIED overclaim, which §1 treats as worse than a missing tag)
| # | Where | Defect | Exact fix |
|---|---|---|---|
| M1 | T-005 inventory row 1 | "proven (two sites shipped)" is quoted, but the header attributes it to CONTEXT.md | Cite VERIFIED(repo library/playbooks/local-site-build.md line 3, 2026-10-12, "Status: proven (two sites shipped") |
| M2 | IDEAS I-010 | "printing $2-$5 per card is UNVERIFIED(E3d)": E3d is about **table tents**, not cards | "card printing cost UNKNOWN (E3d covers table tents only, UNVERIFIED)" |
| M3 | IDEAS I-001 evidence column | "payer VERIFIED(cache a1)": a1 shows agency **asking prices** for "professional builds", not that beauty studios pay | "price anchor VERIFIED(a1, agency asking price); payer for this segment UNVERIFIED" |
| M4 | IDEAS phone-step minutes ("20 min", "5 min", "15 min"...), I-003 "client pastes it in 10 min", T-005 top-5 "delivered in hours", "warm payer" (I-005) | Estimates read as facts | Add one legend line: "All minute figures and delivery times are scout ASSUMPTIONS." Change "warm payer" to "payer UNKNOWN (relationship and payment UNKNOWN, CONTEXT unknown 1)" |
| M5 | T-005 inventory table | Blanket source in the header | Add a per-row Source column (see FP-07, logged today) |

## Not required, but saves a cycle (scout may add; already VERIFIED from the repo)
- Phil's Auto is a real operating business that **already has a live site**. Its README plans 301s from the old site: VERIFIED(repo sites/phils-auto-fleet-repair/README.md lines 252-256, 2026-10-12, "curl -I https://philsautofleet.com/diesel-repair should return `301`"). So the repo build is a replacement. If it was a spec build, I-005's fallback is a private offer of the finished replacement to that one owner, not a walk-in pitch. Payment status stays UNKNOWN.
- On scoring: your 3 was mostly about owner-only gaps (U3 payment rail, U6 contacts). Those are correctly flagged UNKNOWNs, not scout defects. PROTOCOL §3 returns any score under 4, so marking yourself down for the world's gaps would loop. Score what you control. **Bar fixed now, not later:** if U1-U6 and M1-M5 are fixed with no new untagged claim, my re-score is 4.

## Evidence
| # | Claim | Tag | Source (url · date · quoted snippet) |
|---|---|---|---|
| 1 | One untagged claim = automatic rejection | VERIFIED | repo ops/DECISIONS.md D-007 · 2026-10-12 · "Red-team auto-rejects any handoff with an untagged claim" |
| 2 | CONTEXT lists no page count and no chat function | VERIFIED | repo ops/CONTEXT.md line 21 · 2026-10-12 · "booking + Stripe deposit functions, SEO + AI-search kit" |
| 3 | Phil's has 25 pages | VERIFIED | repo sites/phils-auto-fleet-repair/README.md line 7 · 2026-10-12 · "25 indexable pages" |
| 4 | "proven" comes from the playbook | VERIFIED | repo library/playbooks/local-site-build.md line 3 · 2026-10-12 · "Status: proven (two sites shipped" |
| 5 | Lighthouse is the blueprint standard | VERIFIED | repo blueprint/MASTER-BLUEPRINT.md line 25 · 2026-10-12 · "Lighthouse mobile ≥ 90 performance" |
| 6 | E3d is table tents | VERIFIED | repo library/research/lane-a-ideas-2026-10-12.md line 20 · 2026-10-12 · "Printing table tents $2-$5 each" |
| 7 | a1 is an agency asking price | VERIFIED | repo library/research/income-lanes-2026-10-12.md line 14 · 2026-10-12 · "Vendor/agency blog; ceiling anchor for agencies, NOT our price point" |
| 8 | Phil's has an existing live domain | VERIFIED | repo sites/phils-auto-fleet-repair/README.md lines 252-256 · 2026-10-12 · "`philsautoandfleetrepair.com` should 301 to `philsautofleet.com`" |

## Assumptions
- I rejected on contract defects only and did not judge the ideas on their merits. Nothing here says any idea passes or fails.
- The owner-gap UNKNOWNs (U1-U8 in T-005) are handled correctly and are not grounds for rejection.

## Open risks
- Delay: T-006 and T-007 slip by one scout pass (~15 min) plus one red-team pass. The critical path for every service idea is still A-004 (payment rail, did the two sites pay, owned items). The owner can answer it now, in parallel. (Orchestrator/scribe)
- Process: a scout self-score under 4 for owner gaps, combined with the §3 rule that a score under 4 returns the work, can loop forever. Suggested rule: self-scores rate the work, not the world. (Orchestrator)
- Process: TEMPLATE puts "Receiver validation" inside a sender-owned file (§6 conflict). I wrote it here instead. (Orchestrator)
- New pattern FP-07 (blanket citation) appended to `library/failure-patterns.md`.

## Acceptance checklist (T-006 from TASKS.md, verbatim)
- [ ] (1) one-line PASS/FAIL per idea with killing reason — not done: input REJECTED
- [ ] (2) top 5 ranked — not done
- [ ] (3) experiment card per survivor (hypothesis, cost cap, time cap 48–72h, kill/continue threshold, owner phone steps, approval needed) — not done
- [x] (4) automatic REJECTED if any T-005 claim untagged — applied (U1-U6)

## Self-check
- [x] Every claim tagged (Evidence table; each defect row quotes its repo source)
- [x] Only owned files written: this file, `ops/handoffs/T-006-red-team-to-growth.md` (BLOCKED stub), `library/failure-patterns.md` (FP-07)
- [x] No hard-gate action taken (no contact, spend, account, publish; IDEAS.md not edited)
- [x] Under 120 lines
- [x] Cost line filled (token numbers are estimates)

## QUALITY SCORE: 4
Every defect is located and has its replacement text, so attempt 2 needs no research and should take one short pass. Not a 5: I stopped before the legal searches as instructed, so T-006 attempt 2 still has to run the full filter, the cards and 6 searches.
