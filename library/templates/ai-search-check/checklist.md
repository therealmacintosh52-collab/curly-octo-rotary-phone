# AI-search readiness check: 12 points (EXP-A3)

Internal. Scored from screenshots only.
Agents cannot open client sites (sandbox
blocks them; scout E13). The owner screenshots,
agents score, the owner reads and forwards.

Standards come from our own build standard,
`blueprint/MASTER-BLUEPRINT.md` (line numbers
cited per item). They are our standard, not a
Google or AI-vendor rule.

## Scores
- 2 = meets the standard
- 1 = partly there
- 0 = missing or blocked
- N/A = screenshot missing or the tool would
  not run. N/A is not a zero. It goes in
  "What I did not check".

Score % = points / (2 x items checked).
Fewer than 8 items checked = no % at all;
the report says "not enough data for a score".

Bands (our internal rubric, not an industry
benchmark; the report says so):
- 80-100% Strong base
- 50-79% Gaps to close
- 0-49% Foundation missing

## Screenshots to collect
Before the pitch (growth's list, 10 min/site,
`library/outreach/ai-search-check-offer-2026-10-13.md`):
S1 home page top + one scroll · S2 /robots.txt
· S3 /llms.txt · S4 pagespeed.web.dev Mobile
· S5 one AI-assistant answer, dated.

After payment (that one site, ~10 min):
- S6 Share the home page link to yourself in
  a text. Screenshot the preview bubble.
  (If your app never shows previews, skip.)
- S7 The site menu opened (services list).
- S8 Any FAQ section or page.
- S9 A free structured-data checker result:
  validator.schema.org or Google's Rich
  Results Test, paste the URL, screenshot.
  Phone use without login is UNVERIFIED; if
  it asks you to sign in, skip it (N/A).
- S10 Their Google Maps card (top, hours,
  about, photos, services).
- S11 Their Maps reviews, sorted Newest,
  first screen.
- S12 Website footer + one other listing you
  can open without logging in (Yelp, Apple
  Maps, Bing, or Facebook page).

## The 12 points

1. Share-preview title (S6)
Standard: title names service + city, under
60 characters (line 194; unique title line 26).
2 = service and city · 1 = present but generic
("Home", brand only) · 0 = no title shown.
Fix: "Change the page title to
'[[FILL: service]] in [[FILL: city]] |
[[FILL: name]]'. Your web
person can do this in minutes."

2. Share-preview description/image (S6)
Standard: meta under 155 chars, OG image per
page (lines 194, 26).
2 = relevant text or image · 1 = only one, or
generic · 0 = neither.
Fix: "Add a one-line page description and a
preview image so shared links look
trustworthy. Web person."

3. First screen answers the question (S1)
Standard: what, where, how to reach, before
scrolling (lines 24, 27, 182).
2 = service + city + phone/booking visible ·
1 = two of three · 0 = one or none.
Fix: "Put one line at the top: what you do,
where, and a tap-to-call number. Owner writes
it, web person places it."

4. FAQ present (S8, S1)
Standard: real customer questions, two-sentence
answers (line 185; FAQPage line 26).
2 = FAQ section with real Q&A · 1 = thin or
scattered · 0 = none seen.
Fix: "Add 5 questions customers really ask,
answered in two sentences each. Owner writes,
web person posts."

5. robots.txt lets AI crawlers in (S2)
Standard: AI crawler allowlist (lines 27, 196;
example: `sites/cali-tints/public/robots.txt`).
2 = file found, no AI crawler blocked ·
1 = no file found (nothing stated) ·
0 = blocks GPTBot, ClaudeBot, PerplexityBot,
Google-Extended or similar, or blocks all.
Fix: "Your robots.txt tells some AI tools to
stay out. Ask your web person to remove those
lines unless you chose that on purpose."

6. llms.txt present (S3)
Standard: `llms.txt` with business facts
(lines 27, 196). Whether any assistant uses it
is UNVERIFIED; the report says so.
2 = present with name/services/area ·
1 = present, generic · 0 = not found.
Fix: "Optional, low cost: add a plain-text
llms.txt with your name, services, area and
hours. Web person, about 15 min."

7. Structured data detected (S9)
Standard: LocalBusiness + Service + FAQPage
JSON-LD (line 26).
2 = a business type detected plus one more
type · 1 = some data, no business type ·
0 = nothing detected · N/A = checker did not run.
Fix: "Add 'LocalBusiness' structured data with
your exact name, address, phone and hours.
Web person."

8. Mobile speed (S4)
Standard: Lighthouse mobile performance 90+
(line 25).
2 = 90+ · 1 = 50-89 · 0 = under 50.
(Cut-offs are our rubric.)
Fix: "Your phone speed score is [[FILL: n]]. The usual
first steps are smaller images and fewer
plug-ins. Web person."

9. Google profile complete (S10)
Standard: categories, services, photos,
booking link (line 200), plus description and
hours. Six things.
2 = all six seen · 1 = three to five ·
0 = two or fewer.
Fix: "Fill the missing parts of your Google
profile: [[FILL: list]]. Owner, about 15 min."

10. Recent reviews (S11)
Standard: real reviews, never invented (line 23).
Count reviews dated within 90 days on screen.
2 = 3+ · 1 = 1-2 · 0 = none (our rubric).
We never judge review content.
Fix: "Ask every customer for an honest Google
review, with no reward and no picking who you
ask. Owner."

11. Name/address/phone match (S12, S10, S1)
Standard: identical on every listing (line 200).
2 = identical in all three · 1 = same facts,
different format (Ste/Suite) · 0 = a different
phone, address or name anywhere.
Fix: "Your [[FILL: item]] differs between
[[FILL: A]] and [[FILL: B]].
Make it match everywhere. Owner."

12. One page per main service (S7)
Standard: one keyword family per URL (line 26;
service pages line 161).
2 = each main service has its own page ·
1 = some · 0 = one page lists everything.
Fix: "Give your top service its own page that
answers who/where/price-approach/how to book.
Web person."

## Top 3 fixes: how to pick
Take the three lowest scores. Ties: this order
5, 3, 9, 11, 4, 1, 8, 7, 10, 12, 2, 6.
Copy the fix text, fill its [[FILL: ...]]
parts from the screenshots, say who can do it.

## Never in the report
Rankings, AI citations, traffic or lead promises.
Claims about pages not screenshotted. Review
content. Anything that needed a login.
Not scored: the AI-assistant answer (S5). It
goes in as a dated snapshot only.
