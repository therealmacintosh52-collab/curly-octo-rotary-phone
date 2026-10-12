# T-007 — growth → orchestrator

**Status:** DELIVERED
**Task:** ops/TODAY.md with 3-7 owner-only actions ranked by $/min; every asset drafted under library/outreach/ and linked; compliance lines present; nothing sent
**Attempt:** 1 of 3
**Cost:** ~75k in / ~28k out tokens est., ~25 min wall · model sonnet · 2 WebSearch (cap 3) · cash spent $0. No Gmail tool used (sender identity unconfirmed, A-004 Q3).

## Input validation (growth input contract)
- Red-team T-006 handoff: VERDICT PASS-WITH-CONDITIONS, 5 cards, conditions C1-C8, quality 4. Met. No qa-PASSED deliverable exists; the scout prospect list passed red-team (T-006 table). Met.
- Owner time budget: 3-7 h/week (CONTEXT.md, STATE.md "0 of 3-7"). Day 1 asks ~63 min, Wed ~40 min, Fri ~60 min (meetups); ~3 h total, inside budget (ASSUMPTION).
- Mismatch to fix: DECISIONS.md and STATE.md say A-004 has "10 questions"; CONTEXT.md lists 9. I used the 9 in CONTEXT order (Q1 paid, Q2 rail, Q3 sender, Q4 license, Q5 platforms, Q6 Zendrop, Q7 tax, Q8 inventory/services, Q9 other customers), which matches red-team's Q-numbers. Orchestrator to reconcile.

## What was done
Rewrote `ops/TODAY.md` (42 lines) for Tue 2026-10-13: 5 actions, ranked by expected $ per owner minute (Zendrop ~$9.70/min, then the A-004 gate, then EXP-A2 ~$0.90, EXP-A4 ~$0.85, EXP-A1 ~$0.26). EXP-A3 is a "Coming Wed" note (its first owner step is Wed). EXP-A5 rides inside the A2/A4 texts, so it has no separate action. Wrote 6 asset files, one per card. Every opening text has the sender's real name placeholder, one-text-only, a STOP line, no urgency, and a compliance block listing what the owner must fill. Nothing was sent, posted or drafted in Gmail.

## Outputs
- `ops/TODAY.md` — Day 1 action list
- `library/outreach/owned-items-sale-2026-10-13.md` — EXP-A1 listing template, comps method, meetup lines, 5-item checklist
- `library/outreach/gbp-pack-offer-2026-10-13.md` — EXP-A2 $99 pack: text (version B adds the $29 line), follow-up, deliverable list, payment line
- `library/outreach/ai-search-check-offer-2026-10-13.md` — EXP-A3 $49: text, screenshot list, report outline
- `library/outreach/founding-site-offer-2026-10-13.md` — EXP-A4 $450/$150 or $590: text, deposit-first reply, terms line, "sample builds" wording
- `library/outreach/review-card-kit-2026-10-13.md` — EXP-A5 $29 kit and card text, compliant wording
- `library/outreach/care-plan-reserve-2026-10-13.md` — I-005/006 reserve, unused unless A-004 Q1 = paid
- `ops/handoffs/T-007-growth-to-orchestrator.md` — this file

## APPROVALS NEEDED (one line each, yes/no, exact text)
```
A-002  "Cancel my Zendrop subscription ($29/mo). I do it myself in the Zendrop app." Recommended YES. (DECISIONS.md A-002)
A-004  "I will answer the UNKNOWNS block in ops/CONTEXT.md (Q1-Q9)." Q5+Q8 by Tue 12:00 (gates EXP-A1); Q1-Q4 before any service text. (DECISIONS.md A-004)
A-007  "I have read growth's draft for EXP-A2. I approve sending it from my own phone, once, to each business I screenshotted for that card, with at most one reply-follow-up, stopping on any no/stop. Expires 2026-10-18."
A-008  same wording with "EXP-A3" (AI-search check). Expires 2026-10-18.
A-009  same wording with "EXP-A4" (founding site). Expires 2026-10-18.
A-010  "I approve applying myself for a business license in my city (Elk Grove or Sacramento), fee up to $25, before I accept the first service payment." Only if A-004 Q4 = no license.
A-011  "I approve activating <rail I name> myself; agents create nothing." Only if A-004 Q2 = no payment rail.
Note: A-003 (SP-2 preview deploy) is needed only after a deposit CONFIRMED for EXP-A4. A-005, A-006, A-001 are not needed for Day 1.
```
Scribe: A-007..A-011 are red-team's proposals (T-006) and are not yet in DECISIONS.md; they become valid only when logged with the owner's yes.

Expected: 11 businesses texted (5 GBP + 3 AI-search + 3 site) → ~3 replies (25%) → ~1 asks price/details (8%) → ~0.7 paid (6%). UNVERIFIED: no local payer data; rates are growth ASSUMPTIONS.
- EXP-A2 5 sent → ~1 reply → ~0.3 paid × $99 ≈ $30 · EXP-A3 3 sent → ~0.2 paid × $49 ≈ $9 · EXP-A4 3 sent → ~0.2 deposits × $150 ≈ $27 · EXP-A5 8 offers → ~0.2 × $29 ≈ $7 · EXP-A1 5 listings → ~6 buyer messages → ~$25 (50% × $50 target; inventory UNKNOWN).
- Total ≈ $98 expected; chance of at least one paid service ≈ 1 − 0.94^11 ≈ 49% (UNVERIFIED, same assumption). Red-team's $327 is the "all five hit" ceiling, not an expectation.
Kill check (red-team T-006): per-card H72 thresholds · a missed owner step twice = kill · cash > $25 pauses all · any complaint or stop takes that business off every list. Current reading: 0 sent, $0 spent, 0 approvals logged, clock not started (D0 = the day the owner logs approvals).

## Evidence
| # | Claim | Tag | Source |
|---|---|---|---|
| 1 | Zendrop is $29/mo with $0.00 lifetime revenue | VERIFIED | ops/STATE.md Money and A-002 line: "$29/mo, UBB-20-29 ... $0.00 lifetime" (from T-003 live reads) |
| 2 | Zendrop next charge ~2026-11-08 | UNVERIFIED | inferred in STATE.md |
| 3 | GBP description limit 750 characters | VERIFIED | https://www.brightlocal.com/learn/google-business-profile-description/ · 2026-10-12 · search summary "Several sources confirm the 750-character limit" |
| 4 | "First 250 characters show" advice | UNVERIFIED | third-party blogs only; search said Google's own page was not in results |
| 5 | EGPD Community Exchange Zone, 8400 Laguna Palms Way | VERIFIED (status may be stale) | https://elkgrove.gov/community-safety-programs-and-services/community-exchange-zone · 2026-10-12 · "front parking lot of the police department at 8400 Laguna Palms Way"; articles are years old, owner confirms status |
| 6 | Occasional-sale rule, bought-to-resell needs permit | VERIFIED | https://www.cdtfa.ca.gov/formspubs/pub107 · 2026-10-12 · per T-006 L1/L1b |
| 7 | FTC / Google review rules | UNVERIFIED (L2/L3 in T-006) | wording follows the stricter reading |
| 8 | Prospect names in the site and AI-search lists | VERIFIED as listings; has-website UNKNOWN | library/research/income-lanes-2026-10-12.md rows 1-10 and line 99 |
| 9 | pagespeed.web.dev needs no login; PageSpeed/Maps/Marketplace menu names | UNVERIFIED | T-006 r1; assets say "menu names may differ" |

## Assumptions
- Prices, conversion rates (25% reply, 8% ask, 6% pay), owner minutes, the +10% list / 70% floor pricing rule, $59/mo care plan, and the 24 h delivery times are growth ASSUMPTIONS.
- Owner can screenshot Maps cards and copy a business number from the card (no scraping). Owner's rail can take business/goods-and-services payments (A-004 Q2).
- "Hosting and small text edits" in the $590 annual option is deliverable. The text marks it OWNER CONFIRMS.

## Open risks
- CDTFA "occasional sale" wording says "no more than two sales in a 12-month period"; red-team reads a 5-item sweep as one occasion (C8). It is a reading, not a ruling. The EXP-A1 asset flags it and says no second sweep (owner/red-team).
- Showing Cali Tints and Phil's Auto if they were spec builds: using a real business's name or logo in a portfolio is a brand-use risk. The EXP-A4 asset says describe by trade only until Q1 confirms. Phil's replaces a probably-live site (README), so naming it is the worst case (red-team/Orchestrator).
- Payment-rail TOS for services, and refund terms: the owner must fill [REFUND TERM] and [OWNER DECIDES] lines; unfilled placeholders must not be sent (owner).
- Cell-number Do-Not-Call status is unsearched (T-006 L5 gap). Mitigation in assets: one manual text, business-listed number only, no re-contact (red-team).
- No email path drafted (no Gmail drafts either) because the CAN-SPAM postal address would expose the owner's address (T-006 note). Revisit after Q3.
- EXP-A1 is the lowest $/min but the only no-approval, no-rail test; if the owner's time is short, drop EXP-A3 first, then A1 (Orchestrator).

## Acceptance checklist (from TASKS.md, verbatim)
- [x] (1) ops/TODAY.md with 3–7 owner-only actions ranked by $ per minute, each with expected $ (tagged), minutes, phone steps — 5 actions, 42 lines
- [x] (2) every action's asset drafted under library/outreach/ (message text, listing copy, scripts) and linked — #1 is steps only (cancel in the Zendrop app); #2-#5 link their files
- [x] (3) compliance lines present — compliance block at the top of all 6 files; opt-out, one text, sender identity, no urgency in every message
- [x] (4) nothing sent — no Gmail, no outbound call, no account made

## Self-check
- [x] Nothing sent · [x] every recipient is a business with a public contact (owner-chosen from Maps cards/cache) · [x] compliance lines present · [x] every number tagged · [x] sequences saved to library · [x] under 120 lines · [x] cost line · [x] only owned paths written (ops/TODAY.md, library/outreach/, this file)
- Opening text lengths checked by pattern match: the $99 text is under 300 characters with placeholders; the $49 and $450 texts are under 300 with placeholders; version B ($99 + add-on) is intentionally longer and is labeled.

## QUALITY SCORE: 4
Every action has steps, deadline, approval ID, tagged expected $ and a linked asset, and every file carries compliance gates. Not a 5: all conversion numbers are assumptions, the care-plan and refund terms need owner decisions, and A-004's question count is inconsistent across files. A 5 needs a first week of real send and payment data.
