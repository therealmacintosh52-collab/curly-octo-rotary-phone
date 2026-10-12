# T-013 — growth → qa

**Status:** DELIVERED (draft, needs qa PASS, then red-team re-gate per C11)
**Task:** Convert the three offer kits (EXP-A2 GBP pack $99, EXP-A3 AI-search check $49, EXP-A4 founding site $450/$150 deposit) to live-call and walk-in first contact for auto repair / fleet shops (D-028, T-011 C3, C11)
**Attempt:** 1 of 3
**Cost:** ~45k in / ~9k out tokens (estimate), ~12 min wall · model sonnet · 0 WebSearch calls

## What was done
Read PROTOCOL §1 and §3, T-011 (C3, C11, text-ad finding E4, name ruling), D-027/D-028, the EXP-A2/A3/A4 cards, the qa send-asset checklist, the three kits and the free-audit template. Wrote one reusable file: for each offer a 45-second call opener and a walk-in opener led by one owner-observed Google fact; the spoken permission ask with a CRM log; a post-yes follow-up text under 320 characters with opt-out; the top 5 objections; a 10-row prospect worksheet. Sender is [OWNER LEGAL NAME] only. No Gmail drafts created, nothing sent, no one contacted, no prices invented.

## Outputs
- `library/outreach/first-contact-call-walkin-2026-10-13.md` — compliance box, openers (a), permission ask (b), texts (c), objections (d), worksheet (e), log line

## Evidence
| # | Claim | Tag | Source |
|---|---|---|---|
| 1 | Prices $99 / $49 / $450 with $150 deposit equal the EXP cards and kits (A4 text adds the $300 balance = $450 - $150) | VERIFIED (repo) | `ops/EXPERIMENTS.md` l.10-12; kits l.16, l.24, l.17 · 2026-10-12 |
| 2 | First contact = walk-in or live call, no cold text; owner's legal name until name checks done | VERIFIED (repo) | `ops/DECISIONS.md` D-027 l.34, D-028 l.35 · 2026-10-12 |
| 3 | Whether a call, or a text after a spoken yes, satisfies B&P §17538.41 / DNC / TCPA | UNVERIFIED | T-011 E4 and E5 are search summaries; attorney item. Tagged in the file; no ruling made |
| 4 | Best time to call (mid-morning / mid-afternoon) | UNVERIFIED (HYPOTHESIS) | No data; flagged in file |
| 5 | No Google claim beyond the free-audit template: the file states none (the owner's observed fact is plain wording only) | VERIFIED (repo) | grep of the new file for rank / Google says: none; template tags `library/templates/free-growth-audit-2026-10-12.md` |
| 6 | Text lengths ~255-290 after fills (name 25, first name 10, business 25) | UNVERIFIED (hand count; qa to script-count) | checklist item 4 |

## Assumptions
- The owner's spoken yes on a call is an acceptable basis to send one text. This is the owner's own decision and is UNVERIFIED legally (E4/E5, C11). The file says so; red-team re-gates.
- The voicemail rule (one retry, no pitch) and the 10-shop cap are growth's proposals.
- "I'm in Elk Grove" matches the kits' "in Elk Grove" wording; the owner confirms it is true for them.

## Open risks
- **Scope conflict (red-team / orchestrator):** the EXP-A4 card and kit target Elk Grove lash/nail studios with no Website button; this task asks for auto repair / fleet shops. The A4 opener is therefore a scope change (checklist item 1: "no extra trades"). The EXP card needs an update and red-team confirmation, or A4 stays with studios. A2 and A3 fit auto shops. A4 for BAR-regulated shops: drafted site content must show the registered name and address (T-011 C8).
- **Approval gap:** D-028 holds A-007..A-009. T-011 asked for a new `A-###` to contact up to 10 named shops by call or walk-in. None exists in DECISIONS.md as of 2026-10-12. No contact until it does.
- **A-004 Q2-Q4, A-010:** payment rail and license still gate the first payment (kits C2).
- **C4 overlap:** the $99 pack must never go to a shop pitched the $297 Starter; the file enforces one offer per business, but the owner must also check the Starter list.
- Zero replies after 10 contacts is data: hand to scout for re-targeting.

## Acceptance checklist (from the T-013 task text)
- [x] Three offers, each with a 45-second call opener and walk-in opener, [OWNER LEGAL NAME], no agency brand, one observed Google fact the owner fills — file (a)
- [x] Permission ask "may I text you the details?", text only after spoken yes, yes logged (date, time, who) in Sheets CRM — file (b)
- [x] Follow-up text after yes under 320 characters with opt-out line — file (c), est. 255-290
- [x] Top 5 objections, one-line answers — file (d)
- [x] 10-row prospect worksheet (name, card facts, best time, result) — file (e)
- [x] Prices per D-027 and EXP cards; no result guarantees; no new Google claims — Evidence 1, 5; objection row 3 disclaims results
- [x] Nothing sent, no Gmail drafts — no Gmail tool called

APPROVALS NEEDED (one line each, yes/no):
  G-1 Log a new A-### authorizing the owner to call or walk in to up to 10 named auto repair / fleet shops using `library/outreach/first-contact-call-walkin-2026-10-13.md` (supersedes the held A-007..A-009 for first contact) — owner yes/no, after qa PASS and red-team re-gate
  G-2 Decide whether EXP-A4 targets auto shops (this file) or stays with lash/nail studios per its card — owner/orchestrator yes/no
Expected: 10 contacts → ~5 held past minute 1 → ~2 spoken yes → ~1 price ask → 0-1 payment (all HYPOTHESIS, UNVERIFIED until data; no basis)
Kill check: T-011 K1 (10 audits, 0 "send me the terms"), K2, K3 apply to the Starter; EXP-A2/A3/A4 cards: kill at 0 payment by H72 (A4: 0 positive replies). K4 (any complaint or "who gave you my number" → stop all outreach): current reading 0 contacts made, no complaints, not triggered.

## Self-check
- [x] Every claim tagged · [x] Only owned files written · [x] No hard-gate action taken (nothing sent, no calls, no drafts) · [x] Under 100 lines · [x] Cost line filled · [x] Every recipient type is a business with a public Maps contact · [x] Compliance lines present · [x] Every number tagged · [x] Sequences saved to library

## QUALITY SCORE: 4
All requested parts are present, prices match D-027 and the EXP cards, legal reads are left to a professional, and nothing is contacted. Not 5: text lengths are hand counts, spoken length (about 100 words each) is untimed, the A4 scope conflict is unresolved, and the contact approval does not exist yet.
