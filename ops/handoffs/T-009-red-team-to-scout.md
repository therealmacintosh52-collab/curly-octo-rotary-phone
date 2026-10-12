# T-009 — red-team → scout

**Status:** REJECTED (D-007: untagged claims; one feeds the niche decision)
**Task:** Growth-agency niche shortlist, local pricing, "Vincent Growth" name check (Lane A, MOS stream, D-017)
**Attempt:** 1 of 3 (scout's next delivery is attempt 2)
**Cost:** included in T-011 (`ops/handoffs/T-011-red-team-to-orchestrator.md`) · model opus

## Receiver validation
- Input contract met: NO. DELIVERED + QUALITY SCORE present; tagging fails D-007.
- Independent score: 3/5. The scoring rules were set in advance, losers are shown, and stale pricing and the soft name conflict are disclosed honestly. But the top recommendation sentence contradicts the handoff's own table, and 5 claims carry no tag.
- Full sweep done: every line of the handoff and every row of cache §1–§6, including claims about tool and platform behaviour (FP-08). I checked 3 repo citations; all are correct: Upwork $25–$99 (`library/research/lane-a-ideas-2026-10-12.md:23`), Phil's Auto is in Lodi (`sites/phils-auto-fleet-repair/build.py:45`), MOS ladder (`library/playbooks/growth-agency-mos.md:146-152`).

## Fix list (change only these lines; everything else stands)
| # | Where | Defect | Required fix |
|---|---|---|---|
| U1 | handoff l.39 | "the most marketer-saturated one here" has no tag. V1's quote states a count, not saturation | Tag it UNVERIFIED (judgment) or delete it |
| U2 | l.39 | "result guarantees, which is exactly what HVAC owners ask for" is an untagged claim about how buyers behave | Tag it UNVERIFIED or delete it |
| U3 | l.39 | "Orbital itself sells lead lists ... VERIFIED V1": V1's quote ("636 active HVAC companies") does not state this (FP-07) | Cite a source that states it. V7 shows an Orbital lead-list URL; quote that URL, or tag the claim UNVERIFIED |
| U4 | l.41 | "the only niche with an owner reference site and a $300+ typical ticket" has no tag and is contradicted by the table: tint has Familiarity 10 and Ticket 6 (the $300–$800 band), and the auto ticket rests on T5, which is UNVERIFIED | Rewrite the recommendation without "only". State that the auto ticket is UNVERIFIED (T5). Red-team has already ruled on the niche in T-011; the scores need no change |
| U5 | l.73 | "scout has no append tool for that file (only full rewrite...)" is an untagged claim about tool behaviour | Tag it VERIFIED(`.claude/agents/scout.md:4`, "tools: Read, Grep, Glob, WebSearch, Write"). The claim is true; only the tag is missing |
| N1 | cache T1 | The VERIFIED tag on "$14,000-$20,000+" quotes "$14,000 to $16,000+". "Other sources $5,800-$23,000" has no tag | Make the claim match the quote, or tag the remainder UNVERIFIED. Non-blocking: the score is 10 either way |
| N2 | l.40 | "the shop needs several extra jobs a month just to break even" gives no math | Show the math ($500 ÷ ~$320 = 1.6 jobs of revenue, before the shop's cost), label it UNVERIFIED (from T4), or delete it. Non-blocking |

## Re-gate
Red-team re-checks U1–U5 and runs one more full sweep. The re-gate bar is unchanged: zero untagged claims. The substantive rulings (niche, prices, name) are in T-011 and will not be reopened by this fix.

## QUALITY SCORE: 4
Every defect has a line number and a fix. I re-checked tool behaviour against the agent file rather than assuming it. Not 5: I did not re-run scout's 36 searches, so the other VERIFIED tags were judged only on form, not re-confirmed.
