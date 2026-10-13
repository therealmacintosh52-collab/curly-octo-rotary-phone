# T-014 — qa → growth

**Status:** DELIVERED (verdicts below: 3 PASS, 2 FAIL with 1-line fixes)
**Task:** qa gate on customer-facing copy before the first send (PROTOCOL §3; INC-016)
**Attempt:** 1 of 3
**Completed (UTC):** 2026-10-13T00:16Z
**Cost:** ~75k in / ~6k out, ~12 min wall · model sonnet
**Tools used:** Read, Bash (grep/awk/python3 -I, check_deliverable.py, date, heredoc to write this file and the checklist), Write not used. No edits to outreach files.

## VERDICT BY FILE (conditions C1-C15 read from ops/EXPERIMENTS.md lines 5-18)
| File | VERDICT |
|---|---|
| gbp-pack-offer-2026-10-13.md | PASS |
| founding-site-offer-2026-10-13.md | FAIL (C7 dangling "Terms below") |
| upwork-catalog-listings-2026-10-14.md | FAIL (bracket placeholders in a "paste as is" block) |
| taskrabbit-profile-2026-10-14.md | PASS |
| owned-items-sale-2026-10-13.md | PASS |

## Fixes for growth (re-submit as attempt 2; qa re-checks only these)
1. FOUNDING SITE, C7. Line 28 (deposit reply) ends "Terms below. Deposit link: [PAYMENT LINK]" and line 35 ends "Terms below.", but the Terms line (l.40) is a SEPARATE block. The owner can send l.28 with a payment link and no terms. Fix: put the Terms line inside the l.28 block (before the deposit link), or add an explicit step "send Terms line (below) in the same message BEFORE the link". Also the Terms block holds `[YOUR NUMBER]`; add it to the Fill checklist (l.9).
2. UPWORK Listing 2, paste-as-is block, l.71: `"best [your trade] in [your city]"` will show literal brackets to buyers (lint hit: fenced-block line 20). Reword with no brackets, e.g. `one dated AI-assistant answer to a "best <your trade> near you" search for context` or "a local 'best in town' style question for your trade and city".
3. Notes (not blocking, fix when convenient): (a) Site opener l.17 says "about 410 characters"; actual is 375 before fill-ins (python len). (b) "Founding-client price" is honest only if you will charge more later; owner to confirm before sending. (c) Owned-items description says "Cash at a public meetup" while the chat lines allow Zelle; align. (d) TaskRabbit: 2 tasks (300 min) leaves 120 min of the 420-min week for every other test; fine as a cap, flag to growth for TODAY.md.

## Criterion proofs
(1) Identity / one text / STOP / no urgency
- GBP l.18: "Hi, I'm [YOUR NAME] in Elk Grove... One text only; reply STOP to opt out." l.11: silence/no = never again; follow-up only if THEY reply (l.25). l.27 "Reply STOP anytime". PASS.
- Site l.19 same pattern with [YOUR NAME], [STUDIO], STOP; l.11 one text. PASS.
- Urgency: `grep -in "limited|spots|today only|hurry|last chance|countdown|act now"` returns only l.12 of the site file, which is the prohibition. PASS (note 3b).
(2) Claims
- `grep -in "rank|traffic|calls|guarante|years|stars|rating|award|licensed|insured|certified|testimonial|#1"` over the four files: every hit is a prohibition (GBP l.12, l.46; Upwork l.9, l.22, l.44, l.46, l.73, l.91; TaskRabbit l.17). No promise. PASS.
- `grep -in "Cali|Phil"` over the four files: 0 hits. Site l.13 and l.30 use trade only ("a tint shop and an auto repair shop") and l.28 says "sample builds, not live client sites". PASS.
- Upwork feature lists trace to kits: description l.34-42 = 8 headings of gbp-pack/pack-template.md (incl. "Five customer FAQs" l.88); 12 points = checklist.md l.57-163. Lengths (python len): descriptions 820 / 982 (file says ~850 / ~1,000; limit 120-1,200 is UNVERIFIED per file), titles 46/46/57. PASS.
(3) $29 line
- GBP l.18 "a printable QR card that asks every customer for an honest Google review"; Site l.19 "a QR card that asks every customer for an honest Google review". Reply-only lines (GBP l.50, kit l.29) are the approved offer line verbatim. No reward, gating, star or "tell us first" wording (lint: 0 wording FAILs on both fenced openers). PASS on substance. NOTE: the repo holds one approved offer line (review-card-kit l.25-27) plus card variants A/B/C; I found no list of "three approved wordings". The two openers are a shortened form that omits "no reward and no picking who gets asked". Orchestrator to confirm shortened form is acceptable; if not, growth swaps in the verbatim line (adds ~60 characters).
(4) Terms, C12, C14
- Site price + deposit + preview approval visible in the opener (l.19). Terms line l.40 has cancel, no-auto-renew, own your content, but see fix 1.
- Upwork "AI-assisted, human-reviewed" at l.48 (Listing 1) and l.77 (Listing 2); also profile l.22 "drafted with AI help". PASS (C12). No phone/email/URL in any listing (C11): grep for "@|http|[0-9]{3}-" finds only evidence URLs outside blocks.
- TaskRabbit: bio l.15 "Assembly only: no wall mounting and no hauling"; l.20 "Furniture Assembly (the only category)"; l.21 excludes mounting/moving/electrical. Week cap: windows Sat 4 h + Wed 2.5 h = 6.5 h (l.27); accept rule "logged minutes + 150 stay under 420" (l.28); 420 min = 7 h. PASS (C14). Bio has no "licensed/insured/years/best" (l.17 forbids them). Net maths re-computed: $46 / $37 / $16 correct.
(5) Placeholders
- Survey (grep of ALL-CAPS brackets): GBP and Site fill-ins are all visible ALL-CAPS brackets: [YOUR NAME], [THEIR BUSINESS], [ONE TRUE THING], [STUDIO], [PAYMENT LINK], [REFUND TERM], [OWNER DECIDES], [OWNER CONFIRMS], [SAMPLE LINK 1/2], [YOUR NUMBER]. None can send blank without the brackets showing. Upwork and TaskRabbit blocks have zero ALL-CAPS brackets except TaskRabbit bio `[ONE TRUE LINE ABOUT YOU, optional...]` (visible, owner deletes). Exception: fix 2.
(6) check_deliverable.py (python3 -I, whole file and fenced blocks only)
- All five: exit 1. Expected FAILs: no DESC markers (not kits), bracket placeholders, "SAMPLE" (site l.9/l.28 are [SAMPLE LINK] tokens; Upwork l.91 is "SAMPLE report" in a Do-not line, false positive). Upwork l.5 "review near an offer word" is a false positive (seller-review counts in a pre-gate line, not a solicitation).
- Wording-rule FAILs that are real: ZERO on the GBP/Site openers, TaskRabbit bio, owned-items block. One real hit: Upwork fenced l.20 (fix 2). WARNs: Upwork l.44 "5 short facts" and l.9 "certificates" (prohibition), TaskRabbit l.20 "free-text", owned l.21 "smoke-free": all benign.

## Evidence
| # | Claim | Tag | Source |
|---|---|---|---|
| 1 | Conditions C1-C15 as stated | VERIFIED | ops/EXPERIMENTS.md l.5-18 (read 2026-10-13) "C14 B2 assembly only; owner week ≤7 h" |
| 2 | Opener lengths 324 / 375 chars | VERIFIED | python3 len() on the fenced blocks, 2026-10-13 |

## Assumptions / open risks
- Lint is pattern-based; owner read of each text before sending stays mandatory. Real-phone scan of card.png and Upwork/TaskRabbit field limits remain UNVERIFIED (as the files already say).
- No account, send or publish was done by qa.

## Acceptance checklist
- [x] Items (1)-(6) each have a proof line above · [x] gates re-run, not copied · [x] placeholders grep'd

## Self-check
- [x] Only owned paths written (this file; library/checklists/outreach-copy.md) · [x] No hard-gate action · [x] Under 70 lines · [x] Cost line

## QUALITY SCORE: 4
Every criterion has a command-backed proof and fixes are specific. Not a 5: the "three approved wordings" premise could not be matched to any repo list, so criterion 3 rests on my reading of C4/card 5.

Checklist used/updated: library/checklists/outreach-copy.md (new)
