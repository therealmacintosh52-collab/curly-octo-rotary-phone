# T-014b — qa → growth

**Status:** DELIVERED
**Task:** T-014b, re-check of growth T-012b fixes (Repair Protocol step 4)
**Completed (UTC):** 2026-10-13T00:20Z (from `date -u`)
**Cost:** ~35k in / ~4k out · model sonnet
**Tools used:** Read, Bash (grep, python3 len/fence extraction, check_deliverable.py), Write (this handoff + checklist). No outreach file edited; nothing sent.

## VERDICT per file
- `library/outreach/founding-site-offer-2026-10-13.md`: **PASS**
- `library/outreach/upwork-catalog-listings-2026-10-14.md`: **PASS**
- `library/outreach/owned-items-sale-2026-10-13.md` (note 3c): **PASS**

## Criteria and proof (all re-run by me, 2026-10-13)
| # | Criterion | Result | Proof |
|---|---|---|---|
| 1 | Deposit-reply fence (l.28-34): Terms before payment link | PASS | `grep -n "Terms:\|PAYMENT LINK"`: Terms l.31, link l.33 |
| 2 | Annual fence (l.39-43) contains Terms | PASS | Terms l.42, inside fence (python fence extract) |
| 3 | [YOUR NUMBER] in fill checklist | PASS | l.10: "[YOUR NUMBER] (the number they can text to cancel...)" |
| 4 | Opener length vs "375" note | PASS | python len() of fence l.19-21 = 375; note l.18 says 375 |
| 5 | Upwork paste fences have no `[` | PASS | python regex on fences l.32-50 (820 chars) and l.69-79: zero brackets |
| 6 | Listing 2 description length | 1010 chars (python len, fence l.69-79). Limit 1,200 is UNVERIFIED (third-party blog, per file l.16) | fits the stated figure |
| 7 | Owned-items payment line consistent | PASS | l.22 "Cash at a public meetup, or Zelle only after it shows in my balance."; l.35 "Cash only, or Zelle that shows in my balance before you take the item."; l.53 cash/Zelle. Same rule (Zelle only once in balance) |
| 8 | Wording lint on the 4 site fences + 2 Upwork fences | PASS (0 wording-rule FAIL) | check_deliverable.py per fence. Only expected FAILs: no DESC markers, [bracket] fill-ins, "sample" in the sample-builds label (site l.28-34). No fake-urgency hits (grep) |
| 9 | Supporting edits beyond list (growth open risk) | Accepted | "Updated T-012b" notes and the C7 note are accurate; no conflict |


## Notes for growth (no re-fix required)
1. Upwork file l.16 says descriptions are "about 850 and 1,000" characters; actual are 820 and 1010. Cosmetic; update on next touch.
2. Site l.36 (9 card add-on reply) has a payment link and [REFUND TERM] but no full Terms; a different offer that QA passed earlier. Owner fills [REFUND TERM] before sending. Not a FAIL.
3. Still owner-side: note 3b ("Founding-client price" is honest only if the price rises later), 3d (TaskRabbit 120 min spare).

## Evidence tags
VERIFIED: all counts and line numbers above (source: commands run on the repo files 2026-10-13, exit 0 for python; check_deliverable.py exit 1 per fence from expected placeholders only). UNVERIFIED: Upwork 1,200 limit; segment count of the opener.

Checklist used/updated: `library/checklists/outreach-copy.md` (added section 8, re-check recipe)

## QUALITY SCORE: 5
Every criterion has a command proof; counts re-run; checklist extended. Not claiming the Upwork limit.
