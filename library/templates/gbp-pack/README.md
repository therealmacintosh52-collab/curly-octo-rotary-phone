# GBP copy-paste pack, $99 (EXP-A2)

Internal kit. Built by builder for T-010, 2026-10-12.
Offer wording lives in growth's file:
`library/outreach/gbp-pack-offer-2026-10-13.md`.
That file is the promise. This kit delivers it.

## Files
- `intake-checklist.md`
  The 10-minute intake. What to screenshot
  and the 5 facts to ask the client.
- `pack-template.md`
  The deliverable. Fill it, lint it, read it,
  forward it.
- `../check_deliverable.py`
  The lint. Strips internal notes, then
  fails on anything unsafe or unfilled.

## Order of work (after a yes)
1. Payment shows in your balance.
   No pack work before that (C5).
2. Intake: `intake-checklist.md`, 10 min.
3. Send the screenshots and answers to the
   agents in chat. They fill a copy of
   `pack-template.md` (about 15 min).
4. Lint the filled copy (agents run it):
   `python3 library/templates/check_deliverable.py FILLED.md --out CLIENT.md`
   Exit 0 = clean. Exit 1 = fix what it lists.
5. You read CLIENT.md on your phone (5 min).
   You must be able to stand behind every
   line. If unsure about a fact, delete it.
6. Forward within 24 h of payment.

## Placeholder rule
Every blank is written `[[FILL: what goes here]]`.
Nothing else counts as a placeholder.
The lint fails if any `[[FILL` is left.

## What the pack promises (from growth's offer)
- Description under 750 characters
- Category suggestions
- Services list
- 4 post drafts (the brief asked for 3;
  the offer text promises 4, so 4 slots)
- Hours / attributes / service-area list
- 10-shot photo list
- Phone paste guide

## What it must NOT contain
- Google Q&A postings. Red-team kept them
  out (T-006, I-003: feature status
  UNVERIFIED). Section 4 holds 5 customer
  FAQs as plain text the client can use in
  posts, replies or a website. It never
  tells them to post Q&A on Google.
- Rankings, calls, or review promises.
- Prices, offers or discounts the client
  did not give you.
- Years, awards, licenses, warranties or
  ratings the client did not state
  (MASTER-BLUEPRINT line 187:
  "Blank beats fake").
- Any request for their Google login.
