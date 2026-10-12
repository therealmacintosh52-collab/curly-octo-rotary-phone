# T-008 — growth → qa (repair, attempt 1 of 3)

**Status:** DELIVERED
**Task:** Apply qa F1–F11 to the six `library/outreach/*-2026-10-13.md` files (ops/handoffs/T-008-qa-to-orchestrator.md)
**Attempt:** 1 of 3
**Cost:** ~110k in / ~22k out tokens est., ~10 min wall · model sonnet

## What was done
Applied all eleven replacements as written, rewriting each file in full (no edit tool available) and changing only the named lines. Prices, deposits, thresholds, IDs unchanged (A-007 = EXP-A2, A-008 = EXP-A3, A-009 = EXP-A4). Nothing sent, no Gmail drafts. Counts below were checked with anchored regex line-length matches on the saved files, not estimated.

## Items F1–F11 (file:line, new line)
| # | File:line | New text |
|---|---|---|
| F1 | gbp-pack:20 heading, :22 text | Heading now "...(EXP-A5). Same rules." Text: qa's 251-char Version B, verbatim |
| F2 | gbp-pack:39 | last sentence now `No URLs or HTML in it [UNVERIFIED, Google's rule not searched; a precaution, not a stated rule].` |
| F3 | ai-search:10 | qa's line verbatim ("...ONE text each. No bulk app, no auto-dialer, no group text, no scheduled sends. Silence or "no/stop" = never contact again.") |
| F4a | founding:9 | qa's line verbatim; lash/nail only, rows 1-6, barbers and the "Row 8 is a shop" sentence removed |
| F4b | founding:10 | qa's line verbatim (by hand, one text each, no bulk app/auto-dialer/group text/scheduled sends) |
| F4c | founding:19-22 | qa's lead-in and 290-char add-on text verbatim; old "append after..." line removed |
| F4d | founding:32 | annual text unchanged plus ` Reply STOP anytime.` as last sentence |
| F5 | review-card:8 | qa's line verbatim. NOTE: qa cited l.61, file has 35 lines; the "Sale:" line is l.8, edited there |
| F6 | owned-items:7 | qa's line verbatim (CDTFA reading UNCONFIRMED, verify with CDTFA or tax professional before first sale) |
| F7 | owned-items:37 | qa's Fact sentence verbatim; "several years old" sentence kept after it |
| F8 | care-plan:18 | qa's 257-char message verbatim |
| F9 | care-plan:8 | qa's line verbatim |
| F10 | care-plan:23 | ` Reply STOP anytime.` appended after "what's included." |
| F11 | care-plan:28 | ` Reply STOP and I won't ask again.` appended after "No obligation either way." |

## Character counts (raw with placeholders / est. after fills*)
| Text | Raw | After fills |
|---|---|---|
| gbp opening (l.16) | 229 | ~283 |
| gbp Version B (l.22, F1) | 251 | ~305 |
| ai-search opening (l.24) | 240 | ~250 |
| founding opening (l.17) | 290 | ~308 |
| founding add-on variant (l.21, F4c) | 290 | ~308 |
| founding annual (l.32, F4d) | 225 | ~226 |
| care-plan message (l.18, F8) | 257 | ~257 |
| care-plan yes (l.23, F10) | 184 | ~200 |
| care-plan referral (l.28, F11) | 216 | 216 |
| review offer line (l.27) / reply-only (l.29) | 142 / 141 | ~142 / ~157 |
| FOLLOW-UPS (reply-only, over 320): gbp l.27 | 279 | ~342 |
| ai-search l.29 | 324 | ~387 |
| founding l.24 / terms l.35 | 299 / 511 | ~362 / ~560 |
*Assumed fills: name 12, business/studio 25, one-true-thing 60, payment link 30, refund term 60 (growth assumptions, UNVERIFIED).

## Outputs
- Six edited files under `/home/user/curly-octo-rotary-phone/library/outreach/` (all `*-2026-10-13.md`) and this handoff.

## Assumptions
- Follow-ups sent only after the business replies were left as-is: qa marked them ADVISORY, not FAIL, and the repair order was to change qa-named lines only. They exceed 320 once filled.

## Open risks
- Follow-ups over 320 (table above): decide whether to host the terms on one linked page or send as two messages. I did not trim them (would change scope).
- qa line refs in the review-card item (l.61, 80, 82, 88) do not exist; the file has 35 lines. Substance was matched to l.8.
- STATE.md lines 11-13 mapping and EXPERIMENTS C1-C8 gaps remain with scribe, outside my paths.

## Acceptance checklist
- [x] F1–F11 applied · [x] new send texts under 320 raw and after fills · [x] F4a barbers removed rows 1-6 only · [x] IDs/prices unchanged

## Self-check
- [x] Nothing sent, no drafts · [x] Only owned paths written · [x] Under 60 lines · [x] Cost line filled · [x] Counts measured

## QUALITY SCORE: 4
All eleven items applied verbatim with measured counts. Not 5: follow-ups still run over 320 after fills (flagged, not changed), and the review-card line numbers in the qa report were wrong.

## Post-PASS advisory fixes (attempt 2)
Source: qa PASS in `ops/handoffs/T-008-qa-to-orchestrator-a2.md` (advisory items at its l.48 and l.54). Orchestrator instruction. Two one-line edits only. Nothing sent, no Gmail drafts, no other lines touched.

| File:line | Old text | New text | Count |
|---|---|---|---|
| `library/outreach/founding-site-offer-2026-10-13.md:35` | "must appear in the message or a linked page BEFORE payment, C7" | "must appear in the two text messages BEFORE payment, C7" (D-022: terms as two messages, no hosted page) | heading line, not a send text |
| `library/outreach/care-plan-reserve-2026-10-13.md:18` | "Want details? Reply STOP and I won't message about this again." | "Want details? Reply YES. To opt out, reply STOP." | whole message **243 characters** with placeholders as typed (was 257, so −14); under 320 even if both name fills are 25 characters (about 269) |

Count method: hand count by segment, cross-checked as 257 − 14 = 243. No script tool was available in this run, so the count is manual; qa may re-run it.

Open after this fix (not changed here, outside the two named lines):
- `founding-site-offer-2026-10-13.md:37` terms block is still one block of about 511 characters (qa: 511 raw / ~510 filled). It is over 320 and not yet split into two messages. The split point needs an Orchestrator or owner decision.
- Other follow-ups over 320 (gbp l.27, ai-search l.29, founding l.26) are unchanged, per qa's advisory.

Self-check: [x] nothing sent · [x] only the two named lines changed · [x] count stated · [x] owned paths only
Cost: ~40k in / ~5k out tokens est. (estimate), model haiku-5-5

### Split of the founding terms block (coordinator instruction, D-022; closes the open item above)
Founding `:35-38`: the single 511-character terms block at `:37` is now two text messages, each in its own fenced block, labelled "Terms message 1 of 2" and "Terms message 2 of 2", with the markers "(1/2)" and "(2/2)" at the start of each message. The `:35` heading is unchanged.
- Message 1 of 2: **281 characters** with placeholders as typed (hand count: 6 marker + 83 "Terms: … approve the preview." + 42 "Nothing is published … approve it." + 148 refund bracket + 2 joining spaces). Ends with the refund-rule bracket.
- Message 2 of 2: **241 characters** with placeholders as typed (hand count: 6 marker + 137 "Annual option … [YOUR NUMBER] [OWNER DECIDES: pro-rata refund?]." + 75 "Domain name … [OWNER CONFIRMS]." + 21 "You own your content." + 2 joining spaces).
- Arithmetic check: 511 original − 1 joining space + 12 marker characters = 522 = 281 + 241. The original 511 matches qa's raw count, which confirms the method.
- The split is at the sentence boundary after the refund-rule bracket, so message 1 holds the price, deposit, approval and refund terms, and message 2 holds the annual option, cancellation, domain and content terms.
- Wording: no term changed. The "(1/2)" and "(2/2)" markers and the two labels are the only additions.
- Not added, because the source text does not contain them and adding them would change wording: (a) a "no guarantee of specific results" statement; (b) an explicit "Reply STOP to opt out" inside the two terms messages (the STOP opt-out appears in the opening, follow-up and annual texts, not in the terms). The source terms also contain no month-to-month term; they state a one-time $450 site price and a one-year annual option with no automatic renewal. If C7 requires (a) or (b) in the terms messages, owner or qa must supply exact wording before the first send.
- Still open: the other follow-ups over 320 (gbp l.27, ai-search l.29, founding l.26), per qa's advisory.
