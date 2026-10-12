# T-009 — scout → red-team

**Status:** DELIVERED
**Task:** Growth-agency niche shortlist (Sacramento / Elk Grove), local competitor pricing for the MOS offer ladder, brand-name conflict check for "Vincent Growth" (Lane A, MOS stream, D-017)
**Attempt:** 2 of 3 (attempt 1 REJECTED under D-007; fixes listed in "Attempt 2 fixes" below)
**Cost:** ~330k tokens in / ~14k out (estimate), ~40 min wall · model sonnet (36 WebSearch calls). Attempt 2 adds 1 WebSearch (U3) and 1 Grep (U5), small.

## Attempt 2 fixes (red-team fix list U1-U5, plus non-blocking N1, N2)
Only the lines below changed; table, scores, prices and name check are untouched.
- **U1 (l.39):** "the most marketer-saturated one here" is now "possibly heavily targeted by vendors (UNVERIFIED, scout judgment; V1 gives a company count, not saturation)".
- **U2 (l.39):** "which is exactly what HVAC owners ask for" is now "HVAC owners may ask for guarantees (UNVERIFIED, no buyer-behaviour evidence gathered)".
- **U3 (l.39):** replaced the V1 citation. New text: Orbital publishes a Sacramento HVAC lead list. VERIFIED(https://www.withorbital.com/lead-lists/hvac-sacramento, 2026-10-12, search summary: "Orbital maintains a Sacramento list of 100 HVAC companies and contractors, last updated January 5, 2026... full list with decision-maker emails and mobile numbers requires an export request"). The same results list a "Sell to HVAC" page (https://www.withorbital.com/sell-to-verticals/sell-to-hvac), which I did not read. Who buys the list is UNVERIFIED, so "vendors targeting these 636 firms" was dropped. V1 still backs only the 636 count.
- **U4 (l.41):** the word "only" is deleted. The table was right and the sentence was wrong, so I changed the sentence and no score. New text: top pick scores 8.4 on the visible formula; the owner reference site is Phil's Auto (spec build, payment UNKNOWN); the auto ticket score of 8 rests on T5 (average repair visit $838), which is UNVERIFIED; tint has Familiarity 10 and Ticket 6 ($300-$800 band, T4, also UNVERIFIED), so the auto lead is not shown to rest on ticket size.
- **U5 (l.73):** now tagged VERIFIED(`.claude/agents/scout.md:4`, "tools: Read, Grep, Glob, WebSearch, Write"), so scout can only rewrite a file in full, not append.
- **N2 (l.40):** math added: $500 retainer / ~$320 average job (T4, UNVERIFIED) = 1.6 jobs of revenue before the shop's own cost of doing the work, so break-even is above 1.6 extra jobs a month. "Several" is deleted.
- **N1 (cache T1):** claim now matches the quote ("$14,000 to $16,000+" basic swap, VERIFIED); the "$14,000-$20,000+" upper end and "$5,800-$23,000" are tagged UNVERIFIED. Score unaffected (10 either way). Handoff l.34 reworded to match.

## What was done
Read PROTOCOL 1 and 3, CONTEXT, MOS (niche selection, offer ladder), both research caches, IDEAS rows I-001, I-003, I-009, I-018. Scored 10 niches on the five MOS criteria with a visible formula. Collected 8 local price points plus 5 national anchors. Ran the name check. Wrote the cache. All searches 2026-10-12.

## Outputs
- `/home/user/curly-octo-rotary-phone/library/research/agency-niche-and-pricing-2026-10-12.md` — full evidence table (V = volume, T = ticket, P/N = price, B = name)
- this handoff

## 1. Niche ranking
Formula: **Score = (HighTicket + LocalGoogle + BusyNonTech + Volume + Familiarity) / 5**, equal weights because the MOS lists no weights. Each 1-10.
Scoring rules (set before scoring): Volume uses a VERIFIED vendor count (1,000+ = 10, 500-999 = 9, 250-499 = 7, 100-249 = 6); any niche with no count is capped at 6. HighTicket 10 = typical job $5,000+, 8 = $800-$5,000, 6 = $300-$800, 2 = under $300. Familiarity: 9-10 = owner has a finished reference site in that niche, 6-7 = adjacent to Lane A targets, 2-4 = none. LocalGoogle and BusyNonTech are scout judgments (no number exists for them; UNVERIFIED).

| Rank | Niche | Ticket | Local/Google | Busy non-tech | Volume | Familiarity | Score |
|---|---|---|---|---|---|---|---|
| 1 | Auto repair / fleet / collision | 8 | 10 | 9 | 6 | 9 | **8.4** |
| 2 | HVAC | 10 | 9 | 8 | 9 | 3 | **7.8** |
| 3 | Window tint / detailing / auto accessories | 6 | 9 | 8 | 5 | 10 | **7.6** |
| 4 | Plumbing / drain | 9 | 10 | 9 | 6 | 3 | 7.4 |
| 5= | Roofing | 10 | 8 | 8 | 7 | 3 | 7.2 |
| 5= | Dental | 9 | 9 | 6 | 10 | 2 | 7.2 |
| 7 | Med spa | 8 | 7 | 7 | 7 | 6 | 7.0 |
| 8 | Landscaping / hardscape | 7 | 8 | 8 | 6 | 3 | 6.4 |
| 9 | Lash / nail studios | 2 | 8 | 8 | 6 | 7 | 6.2 |
| 10 | Pressure washing / soft wash | 4 | 8 | 8 | 5 | 4 | 5.8 |

Evidence behind the numbers (full tags in cache):
- Volume: HVAC 636 (Orbital) / 691 (Smartscraper, April 2026); roofing 254; med spa 287; dental 1,945; collision "over 150" (directory estimate). All vendor estimates, no government count. Plumbing, tint, general auto repair, lash/nail, landscaping, pressure washing: NO count found, UNVERIFIED, capped at 6.
- Ticket: HVAC basic swap "$14,000 to $16,000+" VERIFIED (Bonney, contractor page; the $20,000+ upper end and other sources' $5,800-$23,000 are UNVERIFIED); roofing $12,000-$22,000 VERIFIED (contractor guide); tint ceramic $400-$850+ and average ~$320 UNVERIFIED; average auto repair visit $838 UNVERIFIED (URL not attributable); lash full set ~$129 VERIFIED (Lash Lounge) so a lash job is under $300.
- Sensitivity: plumbing (7.4) is within judgment noise of #3 tint (7.6). If tint volume were 6 instead of 5 it ties at 7.8 with HVAC. The top 3 order below #1 is not robust.

## 2. Top 3 and the single biggest reason each could be wrong
1. **Auto repair / fleet / collision, 8.4.** Wrong if: Phil's Auto is only a spec build and Lodi is not Sacramento, so the owner has zero paid proof (CONTEXT: client payment UNKNOWN). A pitch built on "see my work" collapses to "I built a site on spec," and a shop's repeat-customer base may leave little room for GBP-driven lift (UNVERIFIED).
2. **HVAC, 7.8.** Wrong if: the niche is possibly heavily targeted by vendors (UNVERIFIED, scout judgment; V1 gives a company count, not saturation; Orbital publishes a Sacramento HVAC lead list, VERIFIED(https://www.withorbital.com/lead-lists/hvac-sacramento, 2026-10-12, "Orbital maintains a Sacramento list of 100 HVAC companies and contractors"), but who buys it is UNVERIFIED), the owner has no reference work, and MOS risk rules forbid result guarantees while HVAC owners may ask for them (UNVERIFIED, no buyer-behaviour evidence gathered). Seasonal demand also unverified.
3. **Window tint / detailing, 7.6.** Wrong if: a ~$320 average job (UNVERIFIED) cannot carry a $500+/mo retainer: $500 / ~$320 = 1.6 jobs of revenue before the shop's own cost of doing the work, so break-even is above 1.6 extra jobs a month (UNVERIFIED, derived from T4); the retainer ROI sentence in MOS CLIENT REPORT would be weak. Shop count unknown, so the pool may be small (7 shops named in one snapshot).
Top recommendation (one line): **Auto repair / fleet shops in Elk Grove and south Sacramento, because it scores highest (8.4) on the visible formula and the owner has a finished reference site there (Phil's Auto, a spec build; the auto ticket score of 8 rests on T5, which is UNVERIFIED, and tint scores Familiarity 10 / Ticket 6 on an equally UNVERIFIED T4); biggest reason it could be wrong is that Phil's Auto may never have paid, leaving no usable case study.** Honest note: the data cannot separate ranks 2-4 and no niche has verified buyer willingness to pay. Lash/nail ranked 9th because the typical job is under $300 (VERIFIED), which conflicts with Lane A idea targeting; lash/nail fits the MOS "free audit" proof step, not a retainer.

## 3. Local pricing for the MOS offer ladder (cache section 3)
| # | Source | Price | Date | Tag |
|---|---|---|---|---|
| P1 | Ranklocally, Sacramento | $500+/mo retainer, $1,000+ project | Oct 2024 | VERIFIED(gartner directory url, "$500 or more monthly minimum"); STALE |
| P2 | WebPerfex, Sacramento | $1,500+/mo, $2,500+ project | 2021 | VERIFIED; STALE |
| P3 | Velocity Media Lab / Lockedown SEO | $2,000+/mo / $1,500+/mo | 2021 | VERIFIED; STALE |
| P4 | Blue Frog Web Design and SEO | retainers from $250/mo, projects from $1,000 | undated (profile 2023) | VERIFIED(blaze.ai, "beginning at $250 monthly"); STALE-risk |
| P5 | Nuoptima listing | from $1,000/mo | undated | VERIFIED(nuoptima.com list page); treat as STALE |
| P6 | Sacramento web-design listings | $2,000-$3,000+ builds; $125 budget build | undated | UNVERIFIED (URLs not attributable) |
| N1 | National GBP management | $300-$600/mo basic, $800-$1,200/mo map-pack; setup $250-$750 | 2026 | VERIFIED(coloradowebimpressions.com) |
| N2 | National GBP setup + audit | $300-$500 one-time | 2026 | VERIFIED(slashpost.ai) |

Findings: **Zero Sacramento-area price points are verifiably under 6 months old.** Every local figure is a stale or undated directory listing; no Sacramento/Elk Grove firm publishes a one-time GBP package price (VERIFIED absence). The recent figures are national. Read against the MOS ladder (hypotheses, not facts):
- Core retainer $500-$1,500/mo sits inside the local directory range ($250 floor, $500-$2,000 typical). $500 is the low-end local anchor (P1, stale); $250 (P4) shows a cheaper competitor exists.
- Starter $197-$497 overlaps the VERIFIED national setup+audit band $300-$500 (N2). The upper half is at market; the lower half undercuts it.
- Idea rows: I-003 ($99 GBP pack) is below every setup price found ($250-$750); I-009 ($49 AI-search check) sits inside the VERIFIED $25-$99 Upwork band; I-001 ($450 site) is below every local build price seen ($1,000-$3,000+, stale); I-018 ($590/yr prepay) is untestable against any local number. Price test evidence cannot come from search; it needs closes.

## 4. Brand-name check: "Vincent Growth"
- **Verdict: CONFLICTED (soft) on the name, UNKNOWN on registries.** 
- Found: Vincent Growth Partners (VGP), a UK agency marketing Google Maps SEO to service-based businesses, domain vincentgrowthpartners.co.uk, Trustpilot 4.3 from 9 reviews. VERIFIED(https://ie.trustpilot.com/review/vincentgrowthpartners.co.uk, 2026-10-12, "Vincent Growth Partners (VGP)"). Same service class, near-identical wording, different country. Search and trademark confusion risk exists; legal exposure in California is UNKNOWN (scout gives no legal opinion).
- Not found (weak, absence only): no California entity, no USPTO record, no Sacramento/Elk Grove business named "Vincent Growth". The search tool cannot do exact-phrase or registry queries, so these are UNVERIFIED, not clear.
- Owner phone checks before spending anything (free, read-only, no account): bizfileonline.sos.ca.gov business search; USPTO trademark search; a domain-availability check for vincentgrowth.com; Google "Vincent Growth" in a private tab. Red-team/owner decide.

## Assumptions
- Equal weights on the five criteria (MOS gives none). Scores for LocalGoogle and BusyNonTech are judgment.
- "Familiarity" counts the two reference sites as owner-built work, not as paid clients (payment UNKNOWN).
- Vendor counts (Orbital, Smartscraper) are used as proxies for volume; they may overcount or include inactive firms.

## Open risks
- **Input contract gap (red-team/scribe):** T-009 has no row in `ops/TASKS.md` yet (last row is T-008), so acceptance criteria are taken from the Orchestrator's task message, not the file. Scribe should add the row.
- **Daily duty not done (Orchestrator):** the 10 new ideas for `ops/IDEAS.md` were not added this session. The task named no ideas deliverable, and scout can only rewrite that file in full, not append (VERIFIED(`.claude/agents/scout.md:4`, "tools: Read, Grep, Glob, WebSearch, Write")); a full rewrite risks corrupting red-team verdict columns. Schedule a separate T-task or grant an append path.
- Stale pricing means the ladder cannot be calibrated from search. Real calibration needs the owner's free audits (MOS days 4-10) and approval-gated conversations.
- If the name check turns up a registry conflict, "Vincent Growth" must be dropped before any publishing or invoicing (owner hard gates).
- Nothing was contacted, created, or spent.

## Acceptance checklist (from the Orchestrator's T-009 message; no TASKS.md row exists)
- [x] >= 8 niches scored 1-10 on each MOS criterion with formula, top 3 + biggest reason each could be wrong — 10 niches, section 1-2
- [x] Volume claims tagged VERIFIED(url,date,snippet) or UNVERIFIED, no invented counts — cache section 1
- [x] >= 5 local price points with tags, STALE if older than 6 months — 6 local (P1-P6) + 2 national, section 3; all local are STALE/undated/UNVERIFIED
- [x] Name conflict check with tags and verdict — section 4: CONFLICTED (soft); registries UNKNOWN
- [x] Research cache written — `library/research/agency-niche-and-pricing-2026-10-12.md`
- [x] Handoff per TEMPLATE under 120 lines with QUALITY SCORE and cost line

## Self-check
- [x] Every claim tagged
- [x] Only owned files written
- [x] No hard-gate action taken
- [x] Under 120 lines
- [x] Cost line filled

## QUALITY SCORE: 3.5
Strengths: scoring rules fixed before scoring, evidence tags on every volume/ticket/price, losers shown, honest that all local prices are stale and the name has a soft conflict. Held below 4 because: no Sacramento price under 6 months old exists (the pricing deliverable is weaker than asked), 6 of 10 niches have no volume count, LocalGoogle/BusyNonTech scores are judgment, and the IDEAS duty was skipped. A 4 needs the owner's 20-minute Google Maps tally per niche and one real audit conversation to replace judgment with a count.

## Receiver validation
Not written here (single-writer rule, PROTOCOL §6). The receiver writes its validation at the top of its reply handoff `T-009-red-team-to-scout.md` (on REJECTED) or in the "Input validation" section of its forward handoff (on ACCEPTED).
