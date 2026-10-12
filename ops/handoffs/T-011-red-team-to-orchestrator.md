# T-011 — red-team → orchestrator

**Status:** Attempt 1 REJECTED (D-007). Attempt 2 re-gate (end of file): PASS-WITH-CONDITIONS.
**Task:** T-011 single gate for the Growth Agency first run (adapter §6): niche, offer-ladder prices, one-page agreement, name
**Attempt:** 2 of 3 (attempt-1 text below is unchanged; the re-gate is appended at the end)
**Cost:** ~220k in / ~24k out tokens (estimate), ~35 min wall · model opus · 17 WebSearch calls, all 2026-10-12 (Mon)

## What was done
Read PROTOCOL §1–§4 and §8, CONTEXT, failure-patterns, MOS (risk rules, phases, offer ladder), T-009 and its cache, T-010 and its 3 templates, and qa's T-012. Swept every line of both inputs. Ran 17 searches on CA and federal law, Google policy, and licensing. Checked 3 repo citations. Ruled on niche, prices, agreement and name. Appended FP-09 to FP-11. I contacted no one, spent nothing, and edited no input.

## Outputs
- `ops/handoffs/T-011-red-team-to-orchestrator.md` (this gate) · `ops/handoffs/T-009-red-team-to-scout.md` (rejection, fixes U1–U5) · `library/failure-patterns.md` (FP-09..FP-11 appended)

## Input validation (full sweep done)
- **T-009: NO, score 3/5.** 5 claims have no tag (U1–U5, in the reply handoff). U4 blocks because it feeds the go decision: l.41 says auto is "the only niche with an owner reference site and a $300+ typical ticket", but in the table tint also scores Familiarity 10 and Ticket 6 ($300–$800), and the auto ticket rests on T5, which is UNVERIFIED.
- **T-010: NO, score 3/5.** U6: audit l.17 "Google gives no weights per factor" has no tag. U7: T-010 l.46 says the audit file has no untagged claim; false because of U6. U8: audit l.23 "Google does NOT frame reviews as a direct ranking lever" is contradicted by Google's own text (E3). U9: the agreement (l.32) and evidence row #6 rest the ARL on a 2018 source, which is stale (§1); the law was amended since (E1). U10 (minor): the Starter citation is MOS l.149, not l.150. Growth fixes U6–U9 with qa's T-012 A1–A5.

## Evidence (WebSearch result summaries, 2026-10-12; no page opened)
| # | Claim | Tag | Source · quote |
|---|---|---|---|
| E1 | CA ARL amended by AB 2863, effective 2025-07-01: express consent, annual reminder, cancellation through the sign-up channel | VERIFIED | btlaw.com/en/insights/alerts/2025/california-expands-automatic-renewal-law-new-requirements-now-in-effect · "same channel used to initiate the subscription" |
| E2 | ARL "consumer" buys for personal, family or household purposes, so business buyers fall outside | VERIFIED (no case law found) | california.public.law/codes/business_and_professions_code_section_17601 · "personal, family, or household purposes" |
| E3 | Google: review count and score feed local ranking | VERIFIED (Google text quoted by a third party) | onelocal.com/google-reviews-local-rankings · "Google review count and review score factor into local search ranking" |
| E4 | CA bans text-message ads to mobile devices; one exception is an existing relationship plus an opt-out | VERIFIED (statute copy current to 2016; current text UNVERIFIED) | casemine.com/act/us/591975f8add7b05bd4dd52ec; apcp.assembly.ca.gov/media/1077 · "existing relationship ... offers an opt-out" |
| E5 | Manual texts mostly outside TCPA autodialer rules, but the FCC's 2024 rule applies DNC to texts to wireless numbers; one court treated cell numbers as "residential" | VERIFIED (single motion-to-dismiss ruling) | jdsupra.com/legalnews/court-allows-putative-class-action-to-6579878 · "do-not-call protections apply to text messages" |
| E6 | UETA: an e-signature counts only if the parties agreed to transact electronically | VERIFIED | stimmel-law.com/articles/electronic-signatures-and-their-requirements-california-latest-case · "agree to conduct the transaction by electronic means" |
| E7 | GBP roles: Primary owner, Owner, Manager; only owners can remove managers | VERIFIED | support.google.com/business/answer/3403100 · "only owners can remove other owners and managers" |
| E8 | Google bars selective review asks, discouraging negatives, and incentives; FTC 16 CFR 465 (Oct 2024) bans fake or paid reviews | VERIFIED | support.google.com/local-guides/answer/2622994; search.ftc.gov/.../2025-Fake-Review-Warning-Template.pdf · "full force and effect of federal law" |
| E9 | Trading under a name without the owner's surname requires an FBN within 40 days plus 4 weeks of publication; Sacramento charges $34 and does not check duplicates | VERIFIED (fee table undated) | sanjoaquin.gov/.../fictitious-business-names · "four consecutive weeks"; finance.saccounty.gov/Tax/Pages/FBNFAQ.aspx · "does not check whether the name is already on file" |
| E10 | Elk Grove general business license $16 for 2 years, covers home-based | VERIFIED | elkgrove.gov/business-license/starting-business · "$16 ... for a two year license" |
| E11 | CSLB: license number required in all ads; the licensee is liable even when an outside agency omits it | VERIFIED | www2.cslb.ca.gov/Newsletter/2019-Spring/3-Advertising-Rules.asp · "inadvertently left off by outside agencies" |
| E12 | BAR: ads must show the shop's registered name and address; new 16 CCR 3371.2 effective 2025-10-01 | VERIFIED | regulations.justia.com/.../section-3371; bar.ca.gov/pdf/regulatory-actions/mobile-referral-ard-2025/approved-text.pdf |
| E13 | CA entity search and CA trademark search (bizfile) are free | VERIFIED | tmbizfile.sos.ca.gov/Search; advocacy.calchamber.com/bizfile · "free" |

## Attack rows
- **1 Legal/TOS.** Cold first-touch texts are the plan's highest risk: CA bans text ads to mobile devices except to an existing relationship with an opt-out (E4), and DNC rules now reach texts to wireless numbers (E5). Many small shops list a cell number (UNVERIFIED). Fix: walk-in or live call first; text only when asked (C3). Red-team's own T-006 gate missed E4 for A-007..A-009 (C11; incident against red-team). ARL likely does not reach business buyers (E2); comply anyway, it is cheap (M1–M3). Reviews and Manager access: right direction, wording tightened (M4, M5). License: Elk Grove $16 (E10, A-010). Sales tax on services or digital content: UNVERIFIED, not searched; attorney/CDTFA item.
- **2 Unit economics (every input a HYPOTHESIS).** Starter $297 minus the 25% tax placeholder (A-005, $74) = about $223; payment fees UNKNOWN until A-011. Owner time per sale: 10 audits × 22.5 min (qa T-012: 19.5 + 3 to deliver) = 225 min, + 15 min terms/payment + 60 min Starter review and send (UNVERIFIED) = 300 min = 5 h. At 1 close in 10 audits: $59/h gross; at 1 in 20: $30/h. At 3–7 h/week: 0.6–1.4 Starters a week, about $780–$1,800/month. Core at about 1 h/week per client (UNVERIFIED), with 2 h/week kept for sales: 5 clients = $2,500 MRR at $500, $7,500 at $1,500. **Ceiling:** $10k/month is unreachable at 7 owner-hours/week unless agents take over fulfillment or price exceeds $2,000/month.
- **3 Time-to-first-dollar (today is Mon 10/12).** Day 0: owner answers A-004 Q1–Q3 (did either site's owner pay, payment app, sender phone) and A-013 (5 min). Day 1: inputs fixed and re-gated; a new A-### for contact. Days 1–3: 3 audits a day by walk-in or call (about 70 min/day). On a "yes": owner texts the terms (2 min), client replies "I agree", owner sends a payment request (2 min), then a payment screenshot to the auditor. Earliest CONFIRMED dollar: Thu 10/15 via a warm lead (Phil's or Cali Tints, if A-004 shows a relationship). Cold path: 10/19–10/23. No payment app adds onboarding time (UNKNOWN).
- **4 Dependencies.** A-004, A-011 (payment app), A-010 (license), A-013 (name), plus a new A-### to contact up to 10 shops by call or walk-in. The sandbox cannot read Maps cards (WebFetch blocked), so every audit is done by the owner by hand. A CAN-SPAM postal address is needed if email is used (UNVERIFIED). The owner decides on attorney review (cost UNKNOWN).
- **5 Failure modes:** in the verdict block. **6 Pattern match:** FP-01 (every owner step above dated; C2/C3), FP-02 (close rate and tickets UNVERIFIED, so no spend plus a hard kill), FP-07 (U3), FP-08 (my T-006 miss). New: FP-09 federal-only legal read, FP-10 pitch contradicts the contract, FP-11 superlative contradicts its own table.

## (1) Niche ruling: auto repair/fleet shops, Elk Grove + south Sacramento
| Niche | Edge for the first paid client | What kills it |
|---|---|---|
| Auto repair/fleet | Largest pool (count UNVERIFIED); reference site; $297 is about 35% of one $838 visit (T5 UNVERIFIED) | Reference shop is in Lodi (build.py:45), outside the area; payment UNKNOWN; drafted ads must follow BAR name/address rules (E12) |
| HVAC | $14k+ tickets (T1 VERIFIED) make ROI easy | No reference work; CSLB number in every ad, shop liable for the agency's omission (E11); saturation and guarantee-seeking UNVERIFIED |
| Tint/detailing | Reference site in Sacramento; light regulation (UNVERIFIED) | ~$320 ticket (UNVERIFIED): a $500 retainer needs 1.6+ extra jobs/month; 7 shops named (UNVERIFIED), so 10 audits may exhaust the area |
The data cannot separate the three; I decided on pool size and the Starter-to-ticket ratio. Switch rule (C2): if A-004 shows Cali Tints paid and Phil's did not, switch to tint. Fastest dollar of all: a warm pitch to whichever site owner the owner knows, under its own A-###.

## (2) Prices growth may quote this week
- **Free audit $0**, capped at 10.
- **Starter $297 one-time, paid in full before work starts.** Inside the VERIFIED 2026 national setup band $250–$750 (N1); its scope (audit + plan + 30 days of content + scripts) exceeds both anchors, so it is not above market. Not $197: undercuts every verified anchor and collides with the $99 EXP-A2 pack. Not $497: no local anchor, no proof. Raise to $397 after 3 closes in the first 5 pitches.
- **Core: no quote this week.** Unlocks after 1 Starter is delivered and M1–M9 are applied; then "from $500/mo, month-to-month" (P1 floor, STALE; inside N1 $300–$600, VERIFIED 2026).
- **Evidence gap:** zero local prices under 6 months old; 0 closes, no close rate; national anchors cover GBP-only scope, not the Starter bundle. Only real closes can calibrate.

## (3) Agreement: changes required before first use
- M1 Clause 3, replace: "3. Term. Starter is one-time: it does not renew and no further charge is made. Monthly renews automatically each month at $[X] on the [day] until cancelled; no minimum term. Client cancels any time by texting CANCEL to [phone] or emailing [email]; Agency confirms within 1 business day; service ends at the end of the paid month and no further charge is made. Agency keeps Client's 'I agree' message for 3 years." (E1)
- M2 Clause 2, replace the price-change sentence: "Starter is paid in full before work starts; monthly is paid in advance. A new monthly price applies only after 30 days' notice and Client's reply 'I agree'; otherwise service ends at the end of the paid month."
- M3 Clause 11, add: "Both parties agree to make, sign and receive this agreement and all notices electronically by text or email." (E6)
- M4 Clause 5, add: "Client keeps the Owner role; Agency asks only for Manager." (E7)
- M5 Clause 8, replace "filtered" with: "Agency never asks only happy customers, never discourages negative reviews, and never offers anything for a review." (E8)
- M6 New clause 12: "Agency drafts customer messages; Client sends them from its own accounts, only to customers who gave Client their number. Agency never messages Client's customers." (E4, E5)
- M7 Parties: "[Owner full legal name], sole proprietor"; a trade name only after the FBN decision (E9).
- M8 Add: "Starter is delivered within [7] days of payment; if not, Client may cancel for a full refund." The pitch's "[X] days" uses the same number.
- M9 Split the text version. Starter: "one-time $297, paid before work, delivered in 7 days or full refund". Monthly: "$[X]/mo, renews monthly until you cancel by text/email". Replace the stale 2018 note (l.32) with E1/E2. Audit script l.63 "No contract" becomes "No long-term contract: one page, one-time or month-to-month" (FP-10).
- **Attorney still needed for:** the liability cap (Civ. Code §1668); whether "I agree" counts as a signature on these facts; current §17538.41 text and whether "they asked on the call" is consent; DNC status of business-listed cell numbers; sales tax on services; whether "[Name] Growth" is a fictitious name.

## (4) Name ruling: not safe in texts yet
- A UK Google-Maps-SEO agency with reviews uses the near-identical name (B1 VERIFIED), so a prospect who searches it may find that agency first (confusion; legal exposure UNKNOWN). If "Vincent" is not the owner's surname, the name is fictitious and needs an FBN ($34 plus newspaper publication, cost UNVERIFIED): spend, needs an A-###. Until then, the sender is the owner's full legal name.
- **Cheapest owner check** (10 min, free, phone): bizfileonline.sos.ca.gov entity search + tmbizfile.sos.ca.gov trademark search (E13); tmsearch.uspto.gov for "Vincent Growth" (URL UNVERIFIED); Google "Vincent Growth" in a private tab. Any US marketing-services hit means drop the name.

## Verdict
```
VERDICT: FAIL (attempt 1): D-007 input defects U1–U9, plus substantive defects fixed by C3, C5, C6, C7
Conditions (must be in TASKS.md acceptance criteria before build):
 C1 T-009 a2 fixes U1–U5; T-010 a2 fixes U6–U9 + qa T-012 A1–A5; red-team re-gate = those lines + full sweep; rulings (1)–(4) stand
 C2 One niche: auto repair/fleet, Elk Grove + south Sacramento; switch to tint only per the A-004 rule in (1)
 C3 First touch = walk-in or live call to the listed number, by hand; text only on request (log it); no cold text/DM
 C4 Quote Starter $297 one-time, prepaid; no Core quote until 1 Starter delivered + C5; never pitch the EXP-A2 $99 pack to the same business
 C5 Agreement M1–M9 applied; owner records an attorney decision (review or accept risk) as an A-### before first send
 C6 qa diffs every price/term word in the scripts against the agreement (FP-10)
 C7 Sender = owner's legal name; "Vincent Growth" nowhere until the check in (4) and the FBN decision
 C8 Drafted shop content shows the BAR-registered name/address and no misleading prices (E12); CSLB number if the niche changes (E11)
 C9 Agency never messages a client's customers (M6)
 C10 A-010 license applied before the first invoice
 C11 Re-gate A-007..A-009 cold texts against §17538.41 before any send
Kill criteria (growth/auditor watch these):
 K1 10 audits delivered, 0 "send me the terms" -> kill this niche/offer, apply C2 switch
 K2 5 terms sent, 0 paid in 7 days -> kill the offer and re-gate it (offer before price)
 K3 Fewer than 2 audits logged by Thu 10/15, or median audit over 25 min -> cut to warm leads plus 1 audit/day
 K4 Any complaint or "who gave you my number", or any text outside C3 -> stop all outreach, open an incident
Top-3 failure modes (indicator -> kill):
 F1 Owner hours never reach audits (FP-01): 0 audit log lines by end of day 2 -> K3
 F2 Cold offer with no local proof does not convert: 0 of the first 5 calls held past minute 1 -> K1
 F3 Legal complaint from texting: any STOP or complaint -> K4
```
**Experiment card (for scribe after the re-gate PASS):** EXP-A6 Starter, auto shops. Hypothesis: 10 public-info audits by walk-in or call produce at least 1 paid $297 Starter in 7 days. Cost cap: $0 cash (license under A-010). Time cap: 72 h for the first 5 audits. Continue if at least 2 of 5 ask for the terms; kill on K1/K2. Owner phone steps: Maps card → audit (about 20 min) → script → terms text → payment request → screenshot. Approval: a new A-### to contact up to 10 named shops.

## Assumptions
- Search summaries stand in for page text. Legal reads are not legal advice: verify with a professional.

## Open risks
- system-qc: log an incident against red-team for the T-006 miss of §17538.41 (C11). Orchestrator: A-007..A-009 are unsafe until re-gated.

## Self-check
- [x] Every attack row cites a source or says UNVERIFIED · [x] math shown · [x] verdict matches the rows · [x] FP-09..FP-11 appended · [x] under 120 lines · [x] cost line · [x] no hard-gate action taken

## QUALITY SCORE: 4
Full sweep and dated legal evidence; every condition can be tested. Not 5: the legal sources are search summaries (statute text for §17538.41 is current only to 2016), and the owner-time figures are estimates until a stopwatch is used.

## Attempt 2 re-gate (2026-10-12)
**Cost:** ~130k in / ~14k out tokens (estimate), ~30 min wall · model opus · 13 WebSearch calls 2026-10-12 (result summaries, no page opened) · 0 contacts, $0
**(1) T-009 a2: ACCEPTED, 4/5.** U1–U5 fixed as asked (l.49 U1–U3; l.51 U4, "only" gone, T4/T5 tagged; l.83 U5); N1 l.44, N2 l.50 done. Full sweep: 0 untagged claims that feed a decision; l.19 "8 local + 5 national" matches cache P1–P8/N1–N5. Carried as UNVERIFIED, non-blocking, predating a1 (my FP-08 misses): l.68 "$450 is below every local build price seen" contradicts P6 "$125 budget build" (cache l.45); l.82 "no TASKS.md row" has no tag.
**(2) T-010 a3: ACCEPTED on tags, 4/5.** Agreement l.14/16/17/18/20/23/26/27 carry M7/M8/M2/M1/M4/M5/M3/M6 word for word; M9 done (l.37, l.41, l.47–48; audit l.67). U6 (l.17), U8 (l.20–24) and U9 (l.47) are fixed. Four lines of live copy still fail: audit l.70 is a cold first-touch text (C3; growth flagged it); audit l.63 busy branch texts without a yes (C3); audit l.58 and l.63 "[AGENCY NAME]" break C7; report l.48 example "Ask 3 happy customers" contradicts the rule on the same line, agreement clause 8 and E8 (FP-10). My a1 sweep missed the last two (FP-08).
**(3) C11 ruling, T-013 kit / A-015.** New evidence (2026-10-12):
| # | Finding | Tag · source · quote |
|---|---|---|
| E14 | The FTC TSR misrepresentation ban covers B2B calls from 2024-05-16 | VERIFIED (2024 rule; no later change seen) federalregister.gov/documents/2024/04/16/2024-07180 · "only the prohibition on misrepresentations" |
| E15 | Business landlines are mostly outside TCPA DNC; 9th Cir. (Chennette) presumes mixed-use numbers on the registry are residential | UNVERIFIED (vendor-blog summaries, quote not tied to one URL) |
| E16 | A TCPA DNC private suit needs "more than one telephone call within any 12-month period"; 7th Cir. 2026-07-14: texts are not calls for that suit | VERIFIED kirkland.com/publications/kirkland-alert/2026/07/seventh-circuit-holds-text-messages-are-not-calls-under-the-tcpa |
| E17 | FCC 2015: a one-time reply text to a consumer's request is lawful if it carries "only the information requested" | UNVERIFIED (2015; law-firm summaries, quote not tied to one URL) |
| E18 | CA §17592: a telephone solicitor calls "a California telephone number" to offer goods or services; the DNC list = CA numbers on the FTC registry; §17593 allows small-claims suits | VERIFIED codes.findlaw.com/ca/business-and-professions-code/bpc-sect-17592 (current 2026-01-01); business-number scope UNVERIFIED |
| E19 | §17538.41: still only a 2016 copy; exception = existing relationship + opt-out; AB 1865 (2025–26) would bar texts 9 pm–9 am | VERIFIED calmatters.digitaldemocracy.org/bills/ca_202520260ab1865; current statute text UNVERIFIED |
| E20 | Elk Grove EGMC ch. 4.04: solicitation license from the Chief of Police; the purpose names "door-to-door solicitation, including appointments arranged through cold calling residents". Sacramento City ch. 5.36 solicitor permit; posted signs bind | VERIFIED codepublishing.com/CA/ElkGrove/html/ElkGrove04/ElkGrove0404.html (definitions and exemptions not seen; B2B reach UNVERIFIED) · Sacramento: aggregator only, UNVERIFIED |
| E21 | 16 CCR 3371: ads "clearly show the name and address listed on the" BAR certificate (current to 2024-12-27); 3351.7.3: internet ads show name, BAR number and phone (mobile repair) | VERIFIED regulations.justia.com/states/california/title-16/division-33/chapter-1/article-9/section-3371; law.cornell.edu/regulations/california/16-CCR-3351.7.3 |
- **(a) Live call by hand to the number on the Maps card: LAWFUL, with residual risk.** With no autodialer and no recording, TCPA §227(b) does not apply. DNC protects residential lines (E15), but an owner's cell on the registry may count as residential, and §17592 names any CA number on the registry (E18). One dial per number keeps the federal private-suit trigger unmet (E16). The kit's voicemail retry (l.19) breaks that.
- **(b) Walk-in: no TCPA, DNC or §17538.41 reach. City law applies:** Elk Grove licenses door-to-door and cold-call solicitation, and Sacramento City likely needs a permit (E20). Whether either reaches B2B visits is UNVERIFIED, so walk-ins HOLD in each jurisdiction until that is answered.
- **(c) One text after a logged spoken yes: ALLOWED, with risk.** The text is an ad under §17538.41 unless the call creates an "existing relationship" (UNVERIFIED). E17 supports one reply that carries only the requested details; the kit's (c) texts fit. **A professional must confirm:** the current §17538.41 text and whether a requested reply is exempt; §17592's reach to business-listed cell numbers; EGMC 4.02.021/4.04.015, Sacramento 5.36 and county rules for B2B visits and calls; whether voice consent counts under E17.
- **D-029/C8: the kit's A4 section is NOT compliant.** The opener (l.18), walk-in (l.23) and text (l.35) omit the BAR rule, which appears only in T-013's Open risks; `founding-site-offer-2026-10-13.md` still targets studios.
```
VERDICT (attempt 2): PASS-WITH-CONDITIONS. Rulings (1)-(4), C2-C10, K1-K4 stand; C1 met; C11 ruled above. Nothing is used until qa re-checks the named lines.
 A-015 + T-013 kit: PASS-WITH-CONDITIONS (C12-C18, C20) · Agreement: PASS-WITH-CONDITIONS (C5) · Audit + Report: PASS-WITH-CONDITIONS (C19)
 C12 One dial per number per 12 months; a second dial only at a time the person named. Delete the kit's voicemail retry, l.19 (E16)
 C13 If the answerer says "personal phone", "how did you get my number" or "don't call": apologize, log never contact, and apply K4 (E15, E18)
 C14 No walk-in in Elk Grove until the owner logs the answer to "does EGMC 4.04 cover B2B visits or calls?" (ask at the A-010 license desk); same for Sacramento City 5.36 and county. Obey No Soliciting signs; leave when asked. If calls are covered, stop calls too (E20)
 C15 Text only per kit (b): log the spoken yes first; one text within 1 h, carrying only the requested details, the name and STOP; no second text unless they reply. A-015 records that the owner accepts the open §17538.41 risk until a professional answers (E17, E19)
 C16 A-015 names a count per offer, each at least that card's n. 10 cannot cover A2 5 + A3 3 + A4 3 + A6 5 = 16. Default: A6 5 + A2 5; A4 only as a swap for a no-website shop; A3 parked. scribe re-cards A2/A3/A4: "after one personal text" -> "after one live call or walk-in"; H72 runs from the first call
 C17 A4 for auto shops: kit l.18/l.23/l.35 and the founding-site kit add "the site shows the shop's name and address exactly as on its BAR registration, its ARD number and phone; no prices unless the shop gives them in writing"; the A4 build acceptance criteria repeat this (E21, C8)
 C18 State only what was seen (kit l.11): the TSR ban on misrepresentation reaches these calls (E14)
 C19 Audit: delete l.70. l.63 busy branch -> "No problem. Would it be okay if I text it to you? One text; reply STOP to opt out." (text only on a logged yes). l.58/l.63 "[AGENCY NAME]" -> owner legal name. Report l.48 -> "Ask your next 3 customers, every one, for a Google review today." Then qa runs the C6 diff
 C20 The audit delivery call (audit §4) is added to A-015's named scripts, or EXP-A6 gets its own A-###
Kill: K5 any C13 event or complaint -> stop all channels, open an incident · K6 a city says B2B solicitation needs a permit -> stop that channel there; any permit fee is an A-### · K7 each card's own H72 threshold, counted on its allocated n only
```
**Open risks:** system-qc logs my FP-08 misses (T-009 l.68/l.82; audit l.58/l.63/l.70; report l.48). Applying C19 is condition work, not a 4th T-010 attempt; the Orchestrator rules on that. FP-12 and FP-13 appended to `library/failure-patterns.md`.
**Self-check:** [x] full sweep of both inputs · [x] C11 a/b/c ruled, each with a source or UNVERIFIED · [x] math shown (C16) · [x] verdict matches the rulings · [x] FPs appended · [x] under 150 lines · [x] cost line · [x] no hard-gate action taken
**QUALITY SCORE: 4.** Every C11 leg has a dated source and an explicit residual risk, and each condition is a line edit or a number that can be checked. Not 5: the statutes are search summaries (§17538.41 is still a 2016 copy), and the city-code exemptions were not seen.
