# Marketing plan — Phil's Auto & Fleet Repair

Owner of this plan: whoever runs the shop's marketing. Everything below is sequenced so the
first week is the highest-leverage, lowest-cost work. No figures in this document are
projections; where a number matters, it is a real one from the site or a rule of thumb, and
it says which.

## 1. Positioning (what every channel repeats)

- **One line:** Honest auto, diesel and fleet repair in Lodi. Diagnosis before parts, a
  written quote before work, no upsells.
- **Who we beat and how:** dealers on price and straight talk; chains on diagnosis (we fix
  what other shops misdiagnosed); other independents on diesel and fleet capability under
  one roof.
- **Proof we own:** 4.4 out of 5 from 83 Google reviews (re-check before quoting it),
  reviews on Yelp/Nextdoor/MapQuest, the painted shop front, and the "no parts you didn't
  need" story told in the reviews themselves.
- **Three audiences, in order of value:**
  1. Fleet operators in San Joaquin County (ag, construction, delivery, HVAC/plumbing vans).
     Highest lifetime value, fewest competitors, buys on downtime not price.
  2. Diesel pickup owners (Lodi, Galt, Acampo, Lockeford, Thornton). Loyal once won.
  3. Everyday drivers within 15 minutes of E Elm St who are tired of the dealer.
- **Words we use:** diagnosis, quote before work, no upsells, downtime, plain language.
  **Words we avoid:** cheap, discount, deal, "we treat you like family".

## 2. AI answer engines (ChatGPT, Perplexity, Google AI Overviews, Copilot, Claude)

How these actually pick a local shop, and what is done about each:

| How the engine decides | What the site now does | What only the owner can do |
|---|---|---|
| ChatGPT search and Copilot read **Bing's index** | IndexNow key file live at `/d3949c9607ed1d5fc65705366ef0d7a9.txt`; `npm run indexnow` pushes all 26 URLs to Bing after every deploy | Verify the domain in **Bing Webmaster Tools** (import from Search Console) and submit the sitemap. Without this, ChatGPT cannot find the site at all. |
| Perplexity, Google AI, Claude fetch pages live | `robots.txt` explicitly allows GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, Google-Extended, Applebot, Bingbot; `llms.txt` at the root summarises the business and every page in plain text | Never add a "block AI bots" toggle on Netlify or Cloudflare. |
| Engines quote **the first direct answer** on a page | Every service page opens with an "At a glance" block (who, where, hours, vehicles, cost, how to book); every advice post opens with "Short answer" | Keep new pages in that shape: answer first, reasoning after. |
| Entity confidence: the same name, address, phone everywhere | JSON-LD `AutoRepair` entity with `sameAs` to Google, Yelp, Nextdoor, MapQuest, Carfax; `knowsAbout`, hours, service catalog, geo | Make every listing read exactly `Phil's Auto and Fleet Repair · 103 E Elm St, Lodi, CA 95240 · (209) 647-4953`. One stray old phone number on Yelp lowers confidence for all of them. |
| Reviews are the strongest local signal for "best X near me" | Review page, `aggregateRating` schema, review link and QR kit in this folder | Run the reviews engine in section 4. ChatGPT's answers for "best diesel shop in Lodi" lean on Google and Yelp review text, so reviews that *name the service* ("fixed my Duramax injector") matter more than stars alone. |
| Google Business Profile feeds Google AI and Apple/Siri | Site links GBP directions everywhere | Fill the GBP **Services** and **Q&A** sections using the service page copy. Post on GBP weekly (section 6). Claim **Apple Business Connect** and **Bing Places**. |
| Engines like third-party mentions | Advice posts are written to be citable (numbers, intervals, decision rules) | Get listed on Lodi Chamber, Visit Lodi business directory, RepairPal or Carfax "service shops", and the local news "best of" polls. |

Test it monthly. Ask each engine these exact prompts and log which shop they name:

```
best diesel repair shop in Lodi CA
fleet maintenance near Lodi California for work vans
who should I take my truck to in Lodi for a check engine light
honest mechanic near Galt CA
```

If the shop is missing after 6 to 8 weeks of the listings work above, the gap is almost
always Bing (ChatGPT) or GBP completeness, not the website.

## 3. Local SEO (Google Maps and the organic 3-pack)

Week 1, in this order:

1. GBP: primary category **Auto repair shop**; secondary **Diesel engine repair service**,
   **Truck repair shop**, **Brake shop**, **Auto electrical service**. Add all 12 services
   with descriptions pasted from the site. Hours, phone, website, appointment link
   (`/contact/#quote`). Upload 10+ photos: the front, the lift, the bays, the team, a diesel
   on the lift, a fleet van. Photos with the sign visible help Google tie the listing to
   Street View.
2. Citations with the exact NAP above: Yelp, Nextdoor, MapQuest, Carfax, Apple Business
   Connect, Bing Places, Facebook page, Yellow Pages, BBB, RepairPal, Lodi Chamber of
   Commerce. Fix any variant ("Phils Auto", old numbers).
3. Search Console + Bing Webmaster Tools verified, sitemap submitted, home and the diesel
   and fleet pages requested for indexing. Then `npm run indexnow`.
4. Google Search Console → Performance after 4 weeks: which queries land on `/` versus
   `/services/auto-repair/`. Cannibalization notes are in `seo/keyword-map.md`.

Ongoing:

- One new advice post a month from the keyword map (section 5). Each one targets a question
  people actually type or say to an assistant.
- Every advice post links to the two most relevant service pages, and every service page
  links to one advice post. Internal links are the cheapest ranking lever there is.
- Add a photo to GBP every two weeks. Google ranks active listings.

## 4. Reviews engine (the single most valuable recurring task)

Goal: a steady stream, not a burst. Two to four new Google reviews a month keeps the
listing "fresh" and the rating honest.

- **The ask happens at pickup, in person, by the person who did the work.** "If the
  truck's running right, would you mind leaving us a quick review? It helps a small shop
  more than anything." Then the text or the card goes out the same day.
- **Kit in this folder:** `review-request-templates.md` (SMS, email, invoice line,
  counter card copy) and `review-qr.svg` (print for the counter and the invoice).
- **Ask for specifics:** "mention what we fixed and what vehicle" produces reviews that
  rank for "diesel", "fleet", "brakes" and that AI engines quote.
- **Reply to every review within 48 hours**, positive or not, naming the service and the
  vehicle where the reviewer did. Replies are indexed text.
- **Never** buy, gate or filter reviews. Do not ask only happy customers. Both get a
  listing suspended.
- Every quarter, refresh the four quotes on `/reviews/` from the newest real reviews
  (`src/data/site.json` → `reviews`).

## 5. Content calendar (from `seo/keyword-map.md`)

One post a month, 700 to 1,100 words, answer-first, with the "Short answer" block filled
in. Order is by search intent value, highest first:

| Month | Post | Target question | Links to |
|---|---|---|---|
| 1 | Why is my diesel in derate / limp mode? | derate mode diesel truck what to do | diesel-repair, car-diagnostics |
| 2 | How much does a diagnostic cost, and why it saves money | how much is a car diagnostic test | car-diagnostics |
| 3 | DPF regen: what the light means and when to worry | dpf light on what to do | diesel-repair |
| 4 | AC blowing warm in the Central Valley: the three usual causes | car ac not cold causes | ac-heating-repair |
| 5 | Dealer vs independent for out-of-warranty repair | independent mechanic vs dealership | auto-repair, second-opinion |
| 6 | What a fleet inspection sheet should include (with a download) | fleet vehicle inspection checklist | fleet-services |
| 7 | Transmission slipping: is it the fluid or the transmission? | transmission slipping causes | transmission-repair |
| 8 | Battery dying in the heat: why summer kills batteries | car battery dies in hot weather | electrical-repair |
| 9 | Brake pad thickness: the numbers we measure | brake pad minimum thickness mm | brake-repair |
| 10 | Harvest season prep for farm trucks and ag vehicles | farm truck maintenance before harvest | fleet-services, diesel-repair |
| 11 | Timing belt vs chain: what your engine has and when it matters | timing belt replacement interval | engine-repair |
| 12 | Tire wear patterns and what each one means | uneven tire wear causes | tire-repair, suspension-steering |

Each post also becomes: one GBP post, one Facebook/Nextdoor post, one line in the fleet
email (section 7).

## 6. Social and community (low effort, local signal)

- **Google Business Profile posts:** weekly. A photo from the shop that week plus one
  sentence. This is the one social channel that affects rankings directly.
- **Nextdoor business page:** post twice a month; answer any "recommend a mechanic" thread
  in Lodi, Woodbridge, Acampo, Galt with a plain reply, not a pitch.
- **Facebook page:** mirror the GBP posts. Join Lodi/Galt community groups and the
  Central Valley truck and ag groups; answer questions, do not advertise.
- **Instagram (optional):** before-and-after photos of real repairs. Only if someone in
  the shop enjoys doing it; an abandoned account is worse than none.
- **Video:** the hero clip already exists. Two more 15-second clips (a truck on the lift,
  a diagnosis on the scan tool) cover a year of social posts.

## 7. Fleet B2B outreach (the highest-value channel, and the one nobody else in Lodi runs)

Targets within 20 minutes: ag operations and vineyards (Acampo, Lockeford, Woodbridge),
construction and landscaping contractors, HVAC/plumbing/electrical vans, delivery and
courier, propane and fuel delivery, school and church vans, city and county small fleets
(watch for RFQs).

Sequence per prospect:

1. Find the fleet manager or owner (yard sign, Chamber list, Google Maps "near me" for the
   trade). Call first, email second.
2. Offer, in this order: a free walk-around inspection of one vehicle, a one-page
   maintenance schedule for their fleet (the advice post `fleet-maintenance-schedule` is
   the template), a standing appointment slot.
3. Follow up once at 7 days, once at 30. Then quarterly with the newsletter line.

Email template (edit the bracketed bits, keep it short):

```
Subject: One-page maintenance sheet for your [vans / trucks]

Hi [Name],

I run Phil's Auto and Fleet Repair on E Elm St in Lodi. We keep work vehicles on the
road for [trade] outfits around [their town], and we do it on a schedule so trucks
are in the shop on the day they'd sit anyway, not the day they break.

If it's useful, I'll put together a one-page maintenance sheet for your fleet at no
charge, and look over one vehicle while I'm at it. Fifteen minutes, no pitch.

Would [day] or [day] work?

[Name]
Phil's Auto and Fleet Repair · 103 E Elm St, Lodi · (209) 647-4953
https://philsautofleet.com/services/fleet-services/
```

Track in a spreadsheet: company, contact, vehicles, date called, date emailed, outcome.
Ten conversations a month is plenty; fleet accounts are won one at a time.

## 8. Paid (only after sections 3 and 4 are running)

Google Ads, one campaign, Search only, radius 15 miles around 95240, Mon–Sat 7:00–18:00,
call-only or call-first ads. Start small and let the data set the budget; do not set a
budget from this document.

Ad groups and the exact-match seeds:

| Ad group | Seeds | Landing page |
|---|---|---|
| Diesel | diesel repair lodi, diesel mechanic near me, duramax repair, powerstroke repair, cummins repair | /services/diesel-repair/ |
| Fleet | fleet maintenance lodi, fleet repair stockton, commercial vehicle repair | /services/fleet-services/ |
| Diagnostics | check engine light lodi, car diagnostic near me | /services/car-diagnostics/ |
| Brakes | brake repair lodi, brakes near me | /services/brake-repair/ |
| AC (May–Sep) | car ac repair lodi, ac not blowing cold | /services/ac-heating-repair/ |

Negatives from day one: parts, auto parts, salvage, used cars, jobs, hiring, salary,
free, diy, how to, oreilly, autozone, napa, dealership names.

Conversions already wired on the site: `click_to_call`, `get_directions`, `generate_lead`
(see `seo/launch-checklist.md` §5). Import them before spending a dollar.

Skip: Facebook ads (poor intent for repair), Yelp ads (expensive, low incremental), display.

## 9. Measurement

Weekly, 10 minutes:

- GBP Insights: calls, direction requests, website clicks.
- GA4: `click_to_call` and `generate_lead` counts, and which page they came from.
- New reviews this week, and whether each got a reply.

Monthly:

- Search Console: impressions and clicks for the diesel, fleet and home pages; new queries.
- The four AI-engine prompts in section 2, logged in a sheet.
- Fleet pipeline: conversations, inspections done, accounts won.

North-star metric: **quoted jobs per week from the site and GBP** (calls plus form leads
that turned into a quote). Everything above exists to move that.

## 10. 30 / 60 / 90

**Days 1–30**

- Deploy v2, verify Search Console and Bing, submit sitemap, `npm run indexnow`.
- GBP fully filled (categories, services, hours, photos, appointment link). Apple and Bing
  Places claimed.
- Citation NAP fixed everywhere in section 3.
- Review kit printed; the pickup ask becomes routine. Reply to all existing reviews.
- First fleet list built (30 names); ten calls made.

**Days 31–60**

- Post 1 and 2 from the calendar live; GBP posting weekly.
- Nextdoor and Facebook pages active.
- Ten more fleet conversations; first inspections done.
- Search Console review: fix any old URLs still 404ing (add to `public/_redirects`).
- First AI-engine prompt test logged.

**Days 61–90**

- Post 3 live. Google Ads on, diesel and fleet groups only, if calls from organic are
  being answered and quoted (no point paying for calls nobody picks up).
- Refresh the four quoted reviews on `/reviews/` with the newest ones.
- Second AI-engine test. If the shop is still absent from ChatGPT, re-check Bing Webmaster
  Tools: is the domain verified and are pages showing as indexed.
- Decide, from the numbers, what gets more effort in the next quarter.
