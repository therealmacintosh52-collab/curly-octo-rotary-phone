# T-008 — qa → orchestrator

**Status:** DELIVERED
**Task:** qa gate on the six `library/outreach/*-2026-10-13.md` files before the owner sends anything (T-008 not yet a TASKS.md row; criteria supplied in the dispatch)
**Attempt:** 1 of 3
**Cost:** ~150k in / ~9k out tokens est., ~12 min wall · model sonnet

## What was done
Read PROTOCOL §1/§3, EXPERIMENTS A1-A5, DECISIONS (D-020, approvals), T-006 (cards, line 116 conditions C1-C8, wording rules), MOS OPERATING RULE 10 + RISK RULES, then all six files line by line. Counted every fenced message with a script (chars, placeholders unfilled). Cross-checked prices, deposits, dates and IDs against EXPERIMENTS/T-006/T-007/TODAY. No file was edited (growth applies the fixes).

## Outputs
- `ops/handoffs/T-008-qa-to-orchestrator.md` (this file). No checklist saved: dispatch forbids writing in `library/`; see Open risks.

VERDICT: FAIL (6 of 6 files need small line edits; no price, ID or mapping error found, no guarantee, income claim, testimonial or reward language found)
Checklist used/updated: none saved (library/ write barred by the dispatch; the 5-point list below is reusable as `library/checklists/outreach-kit.md`)

## Criterion 1: prices, deposits, thresholds, IDs (PASS except F4a)
| File | Check | Result |
|---|---|---|
| gbp-pack | $99 (l.1,16,27,32), $29 add-on (l.22,50), A-007 (l.5), EXP-A2, 5 max (l.8), 24 h | matches EXP-A2 and D-020 |
| ai-search | $49 (l.1,24,29,33), A-008 (l.5), EXP-A3, 3 sites (l.8), Q2-Q4, 1 h / 24 h | matches EXP-A3; recipients = T-006 card source (cache line 99, checked) |
| founding-site | $450 / $150 / $300 (l.17,24,35), $590 (l.30), A-009 (l.5), EXP-A4, Q1-Q4, SP-2 only after deposit (l.7) | matches EXP-A4 except F4a |
| review-card | $29 (l.1,80,82), EXP-A5, covered by A-007/A-009 (l.2), 8 recipients (l.88) | matches EXP-A5 |
| owned-items | EXP-A1, 5 items, -20% at H48 if <3 messages, kill $0 at H72 (l.30), Q5+Q8, no new A-### (l.5), Tue 20:00 / Wed 10-14 12:00 / Fri 10-16 12:00 (l.52-53) | matches EXP-A1 |
| care-plan | $59/mo, $50 credit = I-005/I-006; needs new approval ID, not A-007..A-011 (l.6); reserve only | matches IDEAS, correctly gated |

## Per-file verdict and FAIL items (growth: replace the quoted line exactly)
Defect codes: M = no explicit "by hand from own phone, no automation" line (criterion 2) · L = text over ~320 chars after typical fill-ins (criterion 4) · O = send asset without opt-out · T = untagged factual claim (criterion 3) · S = scope differs from the EXPERIMENTS card (criterion 1).

### 1. gbp-pack-offer: FAIL (L, T)
- F1 l.20-23 (Version B is 324 chars before fills, about 370 after; file admits "2-3 segments"). Replace the l.22 text with (251 chars, about 300 after fills):
  `Hi, I'm [YOUR NAME] in Elk Grove. [THEIR BUSINESS]'s Google profile has [ONE TRUE THING]. I write copy-paste profile packs for $99. Optional $29 add-on: a QR card asking every customer for an honest Google review. One text only; reply STOP to opt out.`
  and delete the l.20 words "Same rules; longer, so it may send as 2-3 segments." (replace with "Same rules.").
- F2 l.39, "No URLs or HTML in it" is an untagged claim about Google's rules. Replace the last sentence of l.39 with: `No URLs or HTML in it [UNVERIFIED, Google's rule not searched; a precaution, not a stated rule].`
- Passes: compliance l.9 (own phone, by hand, no bulk/auto-dialer), opt-out l.16/22/27, no guarantee (l.11), add-on wording l.50 (every customer, no reward, no picking).

### 2. ai-search-check-offer: FAIL (M)
- F3 l.10 has no "no automation" wording. Replace with:
  `- [ ] Send from your own phone, by hand, ONE text each. No bulk app, no auto-dialer, no group text, no scheduled sends. Silence or "no/stop" = never contact again.`
- Passes: opt-out l.24/29, 240-char opening, "no promise about rankings" l.11/29/38, UNVERIFIED tag on PageSpeed l.18, public pages only l.9.

### 3. founding-site-offer: FAIL (S, M, L, O)
- F4a l.9 pulls in barbers ("barbers if short", rows 7-8). EXP-A4 and A-009 cover lash/nail studios only. Replace l.9 with:
  `- [ ] Recipients: 3 Elk Grove lash/nail studios whose Google Maps card shows NO Website button, YOU checked on your phone. Candidates from the cache (library/research/income-lanes-2026-10-12.md rows 1-6): Unique Beauty, Lashme Brows, P'Inked, Ink.me Aesthetics, Ella Blue, Embellish Nails Studio. Has-website is UNKNOWN until you check. Use the number on the Maps card, not the directory number.`
- F4b l.10 (M). Replace with: `- [ ] Not in EXP-A2/A3 (C3). Send from your own phone, by hand, ONE text each: no bulk app, no auto-dialer, no group text, no scheduled sends. "No/stop"/silence = never again.`
- F4c l.19-20 (L): appending the add-on makes the opening 376 chars. Replace l.19-20 with: `For the review-card add-on (EXP-A5) send THIS text instead of the one above (290 chars before fills):` then the block
  `Hi, I'm [YOUR NAME]. I build simple Elk Grove websites. [STUDIO] shows no website button on Google Maps. Founding price: $450 site, $150 deposit, approve a private preview before paying the rest. Optional $29 QR card asking every customer for an honest Google review. Reply STOP to opt out.`
- F4d l.30 (O). Replace with the same text plus ` Reply STOP anytime.` as the last sentence (225 chars).
- Passes: deposit-first (l.2,40), no fake urgency (l.11), "sample builds" rule C6 (l.12,24), terms before payment C7 (l.13,33), affirmative consent (l.37).

### 4. review-card-kit: FAIL (M)
- F5 l.61 has no manual-send line although l.82 is a send asset. Replace with:
  `- [ ] Sale: add-on line only inside an approved text, or as a reply-only line after a yes. No stand-alone cold text. You type and send every message yourself from your own phone: no bulk app, no automation, no scheduled sends.`
- Passes: wording rules l.58-60,76 match T-006 (every customer, no reward, no "if you were happy", no private-feedback detour); variants A-C neutral; l.82 has STOP; FTC/Google claims tagged UNVERIFIED l.63.

### 5. owned-items-sale: FAIL (T, rule 10)
- F6 l.7: legal reading is flagged "red-team's reading" but not "verify with a professional" (MOS rule 10), and 5 items sold to several buyers could be counted as more than two sales. Replace l.7 with:
  `- [ ] ONE sweep only (C8). CDTFA occasional-sale wording: "no more than two sales in a 12-month period" [VERIFIED same URL]. Whether 5 items sold to different buyers in one sweep counts as one occasion is UNCONFIRMED (red-team's reading, not a ruling): verify with CDTFA or a tax professional BEFORE the first sale. No second sweep within 12 months. CDTFA number 1-800-400-7115 [UNVERIFIED, search summary only].`
- F7 l.37: "two marked stalls, camera" is not in the quoted snippet. Replace the sentence with: `Fact: EGPD Community Exchange Zone, front parking lot, 8400 Laguna Palms Way [VERIFIED https://elkgrove.gov/community-safety-programs-and-services/community-exchange-zone 2026-10-12, search summary "front parking lot of the police department at 8400 Laguna Palms Way"]. Marked stalls and camera: UNVERIFIED, not in that snippet.` (keep the "several years old" sentence after it)
- Passes: no outreach text (buyer replies are inbound-only, so no opt-out needed: N/A), no personal info rule l.8, platform fee UNVERIFIED l.10, ASSUMPTION tags l.29, no income claim.

### 6. care-plan-reserve (not sent today): FAIL (L, M, O)
- F8 l.18 message is 339 chars (L). Replace the l.18 text with (257 chars):
  `Hi [CLIENT NAME], it's [YOUR NAME]. Thanks again for working with me. I offer a monthly care plan: hosting, text edits up to 30 min, and a monthly site check, $59/month, cancel any time by text. Want details? Reply STOP and I won't message about this again.`
- F9 l.8 (M). Replace with: `- [ ] ONE private message per client, typed and sent by you from your own phone (no bulk app, no automation), to the contact you already deal with. Existing relationship; still include the opt-out line. No reply = no second message.`
- F10 l.23 (O). Append ` Reply STOP anytime.` after "what's included."
- F11 l.28 (O). Append ` Reply STOP and I won't ask again.` after "No obligation either way."
- Passes: gated on Q1 + new A-### (l.2,5-6), terms before payment C7 (l.11), market range tagged UNVERIFIED (l.13), referral credit decoupled from reviews (l.30).

## Criterion 3 sweep (all six files)
Grep for guarantee, testimonial, "client" claims, income, "limited", "if you were happy": none present as claims. Named-business claims are owner-observed (Maps card, screenshots) or cache-sourced; none untagged beyond F2, F7. Portfolio is "sample builds" (C6) in the founding file.

## Assumptions
- "Text" = any block the file labels text/message to send by SMS; reply-only follow-ups are checked for opt-out but length is advisory (see risks).
- Fill-in sizes: studio/business names about 20 chars, one-true-thing up to 60 (per gbp l.18).

## Open risks
- ADVISORY (growth): follow-ups are long once links are filled: ai-search l.29 (324 raw), founding l.24 (299 raw + 3 links), founding terms l.35 (511). Host the terms on one linked page or send as two messages; not a FAIL because the files do not label them "text".
- ADVISORY (growth): gbp l.12 "Say so if asked" on AI-assisted drafting. Safer: disclose in the follow-up. Care-plan l.26 limits the referral ask to "clearly happy" clients; fine for referrals, but never copy that filter to a review ask.
- ACTION (scribe/Orchestrator): `ops/STATE.md` lines 11-13 still show the pre-D-020 mapping (A-008 = EXP-A4, A-009 = EXP-A3). D-020 ordered the fix; DECISIONS.md is correct. The owner must not approve from STATE.md until fixed.
- ACTION (scribe): EXPERIMENTS.md cards still lack the C1-C8 conditions (INC-008).
- TOOLING: `library/checklists/` holds only a README, so no checklist existed to reuse. Saving the checklist needs a dispatch that allows writing there.
- Legal/tax items (CDTFA, TCPA, Do-Not-Call on cell numbers, payment-app TOS) remain "verify with a professional"; not resolved by this gate.
- Re-check after growth applies F1-F11: qa re-run is a diff of those lines plus a fresh character count (cheap).

## Acceptance checklist (from dispatch)
- [x] (1) prices/deposits/thresholds/IDs match EXPERIMENTS + D-020: table above; one scope mismatch (F4a)
- [x] (2) compliance line per send asset: FAIL items F3, F4b, F4d, F5, F9-F11
- [x] (3) no guarantee/testimonial/income claim/untagged named-entity claim: F2, F6, F7 only
- [x] (4) phone-readable texts: FAIL items F1, F4c, F8; all other labeled texts 229-299 chars (script count)
- [x] (5) PASS/FAIL per file with line refs and exact replacement lines: above

## Self-check
- [x] Every claim tagged (checked line refs against files) · [x] Only owned file written · [x] No hard-gate action · [x] Under 120 lines · [x] Cost line filled

## QUALITY SCORE: 4
Every criterion has a proof line, every FAIL carries file:line and a paste-ready replacement, and char counts were scripted. Not a 5: I did not save the reusable checklist (barred by dispatch), and the legal reads (CDTFA, DNC) are unresolved, not verified.
