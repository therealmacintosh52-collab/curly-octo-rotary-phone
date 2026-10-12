# AI-search readiness check, $49 (EXP-A3)

Internal kit. Built by builder for T-010, 2026-10-12.
Offer wording and the pre-pitch screenshot list:
`library/outreach/ai-search-check-offer-2026-10-13.md`.

## Files
- `checklist.md` 12 points, how to score
  (0/1/2/N/A), bands, fix text, top-3 rule.
- `report-template.md` the one-page report.
- `sample-report-SAMPLE.md` worked example.
  Fictional business, fictional numbers.
  Never send it.
- `../check_deliverable.py` the lint.

## Order of work (after a yes)
1. Payment shows in your balance (C5).
2. Owner sends the 6 extra screenshots
   (S6-S12 in `checklist.md`), ~10 min.
3. Agents score and fill a copy of
   `report-template.md` (~15 min).
4. Lint (agents run it):
   `python3 library/templates/check_deliverable.py FILLED.md --out CLIENT.md`
5. Owner reads CLIENT.md (5 min), forwards
   within 24 h of payment.

## Standards reused (blueprint/MASTER-BLUEPRINT.md)
- line 23 Trust: real reviews, never invented
- line 24 Conversion: phone in header/hero
- line 25 Speed: Lighthouse mobile 90+
- line 26 Search: unique title/meta, JSON-LD
  (LocalBusiness, Service, FAQPage), OG image
- line 27 AI answer engines: robots.txt AI
  allowlist, llms.txt, answer-first blocks
- line 161 one page per service
- line 182 "At a glance" first-screen facts
- line 185 FAQs: real questions, 2 sentences
- line 194 title under 60, meta under 155
- line 196 robots.txt allowlist + llms.txt
- line 200 GBP filled, NAP identical
Reference crawler list:
`sites/cali-tints/public/robots.txt`.

## Honesty rules
- Observed facts only. No ranking, citation,
  traffic or lead promises (growth offer).
- Free checkers (pagespeed.web.dev,
  validator.schema.org, Rich Results Test):
  working on a phone without login is
  UNVERIFIED (scout r1). Sign-in asked = N/A.
- The rubric bands are ours. The report
  says so.
