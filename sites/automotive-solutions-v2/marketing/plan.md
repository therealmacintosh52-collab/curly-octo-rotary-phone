# Marketing plan — Automotive Solutions by Single

Elk Grove, CA. Family owned since 2001. ASE certified, NAPA AutoCare Center.
4.5 / 5 from 55 Google reviews (checked 2026-09-01).

No budget figures here — those are the owner's call. This is the structure.

---

## 1. Positioning

**The one sentence:** Diagnosis first. Price before work. Nothing you did not approve.

**Who it is aimed at.** Elk Grove drivers choosing between the auto mall's service
departments and a national chain. The auto mall is the real competitor — it is
one of the largest dealership clusters in the region and it sets the local price
expectation.

**The three things only this shop can say:**

1. Twenty-four years in the same town, same family. A dealership service advisor
   has been there eighteen months.
2. A NAPA AutoCare warranty — 24 months / 24,000 miles, honored nationwide. Most
   independents cannot match the "nationwide" part, and customers do not know it
   exists until you tell them.
3. "We will tell you not to spend it." Nobody at a dealership is incentivised to
   say the repair is not worth doing.

**What not to say:** cheap, best in town, "we treat you like family", "passionate".
All four are on every competitor's homepage and none of them are checkable.

---

## 2. AI answer engines

Increasingly the first answer a customer sees is an assistant's, not a list of
links. This site is built for that and it is a genuine early-mover advantage
locally — almost no independent shop in Elk Grove has done any of it.

Already shipped:

- `llms.txt` at the root — the facts, in the order an assistant needs them.
- `robots.txt` explicitly allowing GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot,
  Google-Extended, Applebot-Extended and the rest. Blocking them removes the shop
  from those answers and gains nothing.
- **At a glance** on every service page and **Short answer** on every guide —
  answer-first blocks written the way somebody asks an assistant the question.
- `sameAs` entity links to Google, Yelp, NAPA, BBB, Nextdoor, SureCritic,
  Customer Lobby and Yellow Pages, so the assistant can resolve "Automotive
  Solutions in Elk Grove" to one business.
- IndexNow push to Bing, which is what Copilot and several assistants read from.

Ongoing: once a quarter, ask ChatGPT, Claude, Perplexity and Google AI Overviews
"who should I take my car to in Elk Grove?" and "does an independent shop void my
warranty?" Note whether the shop appears and what it is credited with. That is
the new rank tracking.

---

## 3. Local SEO

The map pack is the whole game for a repair shop. Ranking in it is roughly:
proximity (fixed), prominence (reviews + citations), relevance (GBP + site).

- **Google Business Profile** is worth more than the website. Categories: Auto
  repair shop primary, plus Brake shop, Transmission shop, Auto air conditioning
  service. All twelve services listed. Photos monthly. Q&A seeded with the six
  home-page FAQs — you are allowed to ask and answer your own.
- **NAP consistency.** Name, address and phone identical on Google, Yelp, NAPA,
  BBB, Nextdoor, Apple Business Connect, Bing Places. One mismatched suite number
  is worth real positions.
- **Posts.** A GBP post weekly — seasonal (AC before summer, batteries before
  winter), or a guide link. Low effort, measurable.
- **The service-area page** covers the towns. Do not build one thin page per town;
  those get filtered as doorway pages.

---

## 4. Reviews engine

See `review-request-templates.md` for the wording and the rules.

Target: **+4 Google reviews a month, every month.** That is roughly one ask per
working day with a 20% conversion, which is achievable at a counter. At that rate
the shop passes 100 reviews inside a year, and review count is the prominence
signal that moves the map pack.

Measure: reviews gained per month, and average rating. Not "review requests sent".

---

## 5. Twelve-month content calendar

One guide a month, each feeding a service page, each timed to when people search
for it. Five are already written; the calendar continues from there.

| Month | Piece | Feeds |
|---|---|---|
| Jan | What a "check engine" code actually costs to diagnose | car-diagnostics |
| Feb | Brake noises, ranked by how worried to be | brake-repair |
| Mar | **Get your AC checked now, not in July** | ac-repair |
| Apr | What 30k / 60k / 90k service actually includes | oil-change-maintenance |
| May | Road-trip check before you leave the valley | oil-change-maintenance |
| Jun | Why your car overheats in Sacramento traffic | belts / engine-repair |
| Jul | Does a recharge fix AC? (no, and here is why) | ac-repair |
| Aug | Buying a used car in Elk Grove: the pre-purchase inspection | auto-repair |
| Sep | Smog failed — what happens next | fuel-injection |
| Oct | Battery and charging before the cold snap | electrical-repair |
| Nov | Timing belt: the cheapest expensive job | timing-belts |
| Dec | Is this repair worth it on a car this old | repair-or-replace |

Rule: each piece opens with the Short answer, is 800–1400 words, links to its
service page, and never invents a price.

---

## 6. Social cadence

Low volume, high truth. One post a week, rotating:

1. **A repair, explained.** Photo of the part, one paragraph on what failed and
   how it was found. This is the content nobody else in the niche posts and it is
   the entire brand in one image.
2. **A car on the lift.** Especially anything old or interesting — the '56 on the
   lift is worth more attention than any stock graphic.
3. **A seasonal reminder** tied to the content calendar.

Facebook and Nextdoor first; Instagram only if someone will actually shoot.
Nextdoor recommendations convert unusually well for local trades.

---

## 7. B2B and referral

The auto equivalent of the blueprint's "fleets" section:

- **Used car lots and independent dealers** in Elk Grove and along Highway 99 —
  pre-purchase inspections and recon work. Steady, unglamorous, high volume.
- **Body shops.** They do panels, not mechanical. A body shop with a car that has
  a drivability fault needs somebody, and they refer the same shop repeatedly.
- **Tire shops** that do not do diagnostics — natural referral trade both ways.
- **Property managers / small businesses** with two or three vehicles. Not a fleet
  programme, just a shop they trust.

Outreach email:

> Subject: Mechanical work for your customers in Elk Grove
>
> Hi [name],
>
> I run Automotive Solutions on Elk Grove Blvd — family shop, 24 years, ASE
> certified, NAPA AutoCare. We do the mechanical and drivability work that
> doesn't fit a [body shop / tire shop / lot].
>
> If you've got a car you need diagnosed properly before you commit to it, send
> it over and I'll give you a straight answer the same day where I can. No
> obligation on the first one.
>
> [name] — (916) 686-5277
> automotivesolutionsbysingle.com

---

## 8. Paid, if and when

Structure only. Do not start paid until the GBP is complete and the review engine
is running — paid amplifies whatever conversion rate already exists.

- **Google Local Services / Search, brand-adjacent first:** `mechanic near me`,
  `brake repair elk grove`, `check engine light elk grove`. Exact and phrase match.
- **Landing page = the matching service page.** Never the home page.
- **Negatives from day one:** free, cheap, salary, jobs, hiring, school, course,
  parts, autozone, oreilly, junkyard, salvage, rental, insurance quote, DIY,
  how to, forum, wrecking, dealership names, and every make they do not want to
  specialise in.
- **Call-only campaigns** during shop hours (Mon–Fri 9–6) and nothing outside
  them. A missed call is a wasted click.
- Track `click_to_call` and `generate_lead`, already wired to `dataLayer`.

---

## 9. Measurement

Already instrumented on the site — `dataLayer` events fire with no analytics tag
installed, so adding GA4 or Google Ads later needs no code change:

| Event | Fires on |
|---|---|
| `click_to_call` | any `tel:` link, with `link_location` (hero, header, callbar, footer, service page…) |
| `get_directions` | any Google Maps link |
| `generate_lead` | a successful quote-form submit, with `form_id` |

What to actually watch, monthly:

1. Calls, split by `link_location` — tells you which part of the page earns them.
2. Form submits.
3. Google Business Profile: calls, direction requests, website clicks.
4. Review count and average.
5. Search Console: impressions and clicks for the twelve service keyword families.

What to ignore: sessions, bounce rate, time on page. None of them buy a brake job.

---

## 10. 30 / 60 / 90

**First 30 days**
- Site live, redirects verified, form connected and tested.
- GBP completed: categories, all twelve services, photos, hours, website link.
- Review asks start at the counter. QR card printed.
- Search Console + Bing verified, sitemap submitted, IndexNow pushed.

**Days 31–60**
- Three more real reviews quoted on the site (only one exists today).
- Hero video shot and swapped in.
- Full-resolution shop photos replacing the two low-res ones.
- First two calendar pieces published.
- First B2B outreach: five lots, three body shops, two tire shops.

**Days 61–90**
- First AI-answer audit (section 2) — is the shop being cited?
- Review count up by 8–12 from the start.
- Decide on paid, based on whether organic calls are already at capacity.
- Re-run Lighthouse on the live domain and re-audit.
