# T-012b — growth → qa

**Status:** DELIVERED
**Task:** T-012b, apply QA T-014 "Fixes for growth" (site C7 Terms placement + [YOUR NUMBER] + char count; Upwork Listing 2 brackets; owned-items payment line)
**Attempt:** 2 of 3 (on the two files rejected in T-014: founding-site-offer, upwork-catalog-listings; owned-items-sale was note 3c)
**Completed (UTC):** 2026-10-13T00:00Z (time-of-day not read from a clock; date from session header)
**Cost:** ~45k in / ~9k out, ~6 min wall · model sonnet
**Tools used:** Read, Grep, Glob, Write (all in growth's list). No Bash (so no python re-count; see Evidence 2). Nothing sent, posted or created.

## What was done
1. `founding-site-offer-2026-10-13.md`: full Terms line now inside the deposit-reply block (before the payment link) and inside the annual-option block. [YOUR NUMBER] added to the Fill checklist. Opener note corrected to 375 chars.
2. `upwork-catalog-listings-2026-10-14.md`: Listing 2 description reworded, no brackets in any paste block.
3. `owned-items-sale-2026-10-13.md`: description payment line now "Cash at a public meetup, or Zelle only after it shows in my balance." (matches chat line 35).

## Outputs
- `/home/user/curly-octo-rotary-phone/library/outreach/founding-site-offer-2026-10-13.md`
- `/home/user/curly-octo-rotary-phone/library/outreach/upwork-catalog-listings-2026-10-14.md`
- `/home/user/curly-octo-rotary-phone/library/outreach/owned-items-sale-2026-10-13.md`

## Re-check (Grep, 2026-10-13)
- Site, deposit-reply block l.28-34: `Terms:` l.31, `Deposit link: [PAYMENT LINK]` l.33. Terms precedes link. PASS.
- Site, annual block l.39-43: `Terms:` l.42, inside the fence. PASS.
- Site Fill checklist l.10 now lists [YOUR NUMBER]. Opener note l.18 says 375.
- Upwork paste blocks: Listing 1 l.32-50 and Listing 2 l.69-79: Grep for `[` returns only l.6-12 (compliance) and l.51-52 (below the fences). Zero inside either block. PASS.
- Owned-items: "Cash at" only l.22 (now with Zelle clause); Zelle l.35 and l.53 consistent.

## Evidence
| # | Claim | Tag | Source |
|---|---|---|---|
| 1 | Opener is 375 chars before fill-ins | VERIFIED (QA's count, not mine) | `ops/handoffs/T-014-qa-to-growth.md` l.22, 3a: "actual is 375 before fill-ins (python len)"; l.49 "324 / 375" |
| 2 | I did not re-count | UNVERIFIED | no Bash tool; qa to re-run len() |
| 3 | Upwork Listing 2 stays under 1,200 | UNVERIFIED | QA measured 982 (T-014 l.32); new wording adds about 30 chars by hand estimate |

## Assumptions
- Terms text duplicated verbatim in both blocks so each can be sent alone; owner fills the [OWNER DECIDES] fields identically in both.

## Open risks
- Beyond the exact fixes (small, needed for consistency): a one-line "Updated T-012b" note at the top of the site and Upwork files; site checklist Terms line reworded (it said "Terms line below", which no longer exists as a block); the old standalone Terms block replaced with a short "Terms (C7)" note plus the affirmative-consent line. qa: confirm acceptable.
- Site l.36 (the $29 card add-on reply) still has a payment link with [REFUND TERM] but not the full site Terms. It is a different, QA-passed $29 offer; flagging in case qa wants Terms there too.
- Note 3b (is "Founding-client price" honest) is for the owner; not changed. Note 3d (TaskRabbit 120 min spare) goes to TODAY.md.

## Acceptance checklist
- [x] Terms inside both blocks before any payment link · [x] [YOUR NUMBER] in checklist · [x] count corrected · [x] no brackets in Upwork paste blocks · [x] payment line consistent

## Self-check
- [x] Tags swept · [x] Only owned files written · [x] No hard-gate action · [x] Under 120 lines · [x] Cost line filled

## QUALITY SCORE: 4
All five edits applied and grep-checked with line numbers. Not 5 because the 375 count is QA's, not re-run by me, and I made three small supporting edits beyond the literal list.
