# Keyword map — Phil's Auto and Fleet Repair

One keyword family per page. Titles ≤ 60 characters, meta descriptions ≤ 155 with a CTA.
Lengths are enforced by `npm run check:seo`, not by eye — it reads the
**built** HTML and fails the build on a title over 60, a description outside
70–155, a missing canonical, a duplicate title or description, or anything
other than exactly one H1.

## Read this before you trust a number

**There are no search volumes in this document, and that is deliberate.** This machine cannot
reach Google, Ahrefs, Semrush or any keyword tool — outbound network is limited to GitHub and
npm. Every keyword below is reasoned from the business, the shop's own signage, its real reviews
and how people in the Central Valley actually phrase these searches. **All of it is unverified.**

Before launch, run the primaries through Google Keyword Planner or Search Console and cut or
re-point anything with no demand. The structure will hold; the specific phrasings may move.

What *is* verified, because it came from the shop's own photographs and listing:

| Fact | Source |
| --- | --- |
| Phone (209) 647-4953 | The sign on the building (`signage.jpg`) |
| Tires sold at cost + mount and balancing | The sign in the bay door (`signage.jpg`) |
| Interstate Batteries, Mastercraft Tires | Banners in the bay door |
| ASC (Automotive Service Councils) member | Decal in the bay door |
| Diesel, fleet vans, European and domestic work | The shop's own photographs |
| 4.4 ★ from 83 ratings | Google Business Profile |
| Mon–Sat 8:00–5:00 | Google Business Profile |

---

## Intent model

Three intents drive the structure, and each one gets different pages:

- **Emergency** — something is wrong *now*. Wants a phone number above the fold and a reason to
  trust it. Money pages.
- **Comparison** — has a quote from a dealership or another shop and is checking it. Wants proof,
  not adjectives. Reviews, About, the second-opinion guide.
- **Research** — a light came on and they want to know how worried to be. Advice pages, which
  exist to catch the query early and hand the reader to a money page.

The shop's actual differentiator, straight out of its reviews, is **diagnosis before parts**
("put more effort in than any other shop I have been to", "worked me into his schedule that
day"). That is the angle every page is written from, and it is the concept the 3D hero
dramatises.

---

## Money pages

### `/` — home

| | |
| --- | --- |
| **Primary** | auto repair lodi ca |
| **Secondaries** | mechanic in lodi ca · auto repair shop near me lodi · diesel repair lodi · fleet repair lodi ca · honest mechanic lodi |
| **Intent** | Emergency + comparison |
| **H1** | Honest auto, diesel & fleet repair in Lodi, California |
| **Title** | Auto Repair in Lodi, CA \| Phil's Auto & Fleet Repair |
| **Meta** | Family-run auto, diesel and fleet repair in Lodi, CA. We diagnose before we replace parts, and quote before we start. Call (209) 647-4953. |

### `/services/` — hub

| | |
| --- | --- |
| **Primary** | auto repair services lodi ca |
| **Secondaries** | car repair services lodi · what does an auto shop do · full service mechanic lodi |
| **Intent** | Navigational |
| **H1** | What we repair |
| **Title** | Auto & Diesel Repair Services in Lodi, CA |
| **Meta** | Every service Phil's Auto and Fleet Repair offers in Lodi, CA — diagnostics, brakes, engine, transmission, diesel and fleet. Call (209) 647-4953. |

A hub, not a keyword target. Its job is internal linking: ten descriptive anchors down to the
service pages, and it collects the "what do you actually do" query without competing with them.

### Service pages — `/services/<slug>/`

Each one owns a single family. No two target the same head term; that is the cannibalisation
rule and it is checked below.

| URL | Primary | Secondaries | H1 | Title (≤60) |
| --- | --- | --- | --- | --- |
| `auto-repair/` | auto repair shop lodi ca | car repair lodi · import and domestic repair lodi · general mechanic lodi | Auto Repair in Lodi, CA | Auto Repair Shop in Lodi, CA \| Phil's Auto |
| `car-diagnostics/` | check engine light lodi ca | car diagnostic test lodi · obd2 scan lodi · why is my check engine light on | Check Engine Light & Diagnostics | Check Engine Light Diagnostics, Lodi CA |
| `brake-repair/` | brake repair lodi ca | brake pad replacement lodi · squeaking brakes lodi · abs light lodi | Brake Repair in Lodi, CA | Brake Repair & Pad Replacement, Lodi CA |
| `engine-repair/` | engine repair lodi ca | engine rebuild lodi · timing chain replacement lodi · overheating engine lodi | Engine Repair in Lodi, CA | Engine Repair & Diagnostics in Lodi, CA |
| `transmission-repair/` | transmission repair lodi ca | transmission service lodi · slipping transmission lodi · transmission fluid change lodi | Transmission Repair in Lodi, CA | Transmission Repair & Service, Lodi CA |
| `diesel-repair/` | diesel repair lodi ca | diesel mechanic lodi · duramax powerstroke cummins repair lodi · diesel emissions repair lodi | Diesel Repair in Lodi, CA | Diesel Repair & Diesel Mechanic, Lodi CA |
| `fleet-services/` | fleet maintenance lodi ca | commercial vehicle repair lodi · work van repair lodi · fleet service program lodi | Fleet Services in Lodi, CA | Fleet Maintenance & Repair in Lodi, CA |
| `oil-change-maintenance/` | oil change lodi ca | scheduled maintenance lodi · 30/60/90k service lodi · synthetic oil change lodi | Oil Change & Maintenance | Oil Change & Scheduled Service, Lodi CA |
| `tire-repair/` | tires lodi ca | tire mounting and balancing lodi · flat tire repair lodi · mastercraft tires lodi | Tires in Lodi, CA | Tires, Mounting & Balancing in Lodi, CA |
| `electrical-repair/` | car electrical repair lodi ca | car battery replacement lodi · alternator replacement lodi · starter repair lodi | Electrical & Batteries | Car Electrical Repair & Batteries, Lodi |

**Tires is the page with a real, verifiable hook.** The sign on the building reads *"TIRES SOLD AT
OUR COST — YOU PAY WHAT WE PAY + MOUNT AND BALANCING."* That is a genuine local differentiator
and it belongs in the H2, not buried. It is photographed, so it is safe to state.

### `/service-areas/`

| | |
| --- | --- |
| **Primary** | auto repair near lodi ca |
| **Secondaries** | mechanic serving galt ca · auto repair acampo ca · mechanic woodbridge ca · diesel repair lockeford ca |
| **Intent** | Local discovery |
| **H1** | Where we work |
| **Title** | Auto Repair Serving Lodi, Galt & Stockton, CA |
| **Meta** | Phil's Auto and Fleet Repair serves Lodi, Stockton, Galt, Acampo, Woodbridge, Lockeford and nearby. Drive times and directions. Call (209) 647-4953. |

**One page, not ten city pages — deliberately.** Separate `/auto-repair-galt/`,
`/auto-repair-acampo/` pages built from the same paragraphs with the city swapped is doorway-page
territory, and Google has been deflating it for years. If the shop later wants city pages, each
needs something only that city has: a named landmark, real drive time, a customer from there who
agreed to be quoted. That is a content problem, not a template problem. Flagged as **phase 2,
blocked on real material**.

### `/reviews/`, `/about/`, `/contact/`

| URL | Primary | Intent | H1 | Title (≤60) |
| --- | --- | --- | --- | --- |
| `/reviews/` | phil's auto and fleet repair reviews | Comparison — brand + trust | What customers say | Reviews — Phil's Auto & Fleet Repair, Lodi |
| `/about/` | phil's auto and fleet repair lodi | Brand | The shop on E Elm Street | About Phil's Auto & Fleet Repair, Lodi CA |
| `/contact/` | phil's auto and fleet repair phone number | Emergency — already decided | Get a quote or book the shop | Contact Phil's Auto & Fleet Repair, Lodi |

`/reviews/` carries the four real reviews verbatim (three Yelp, one MapQuest) and nothing
invented. It is the page that closes the comparison searcher, so it links hard to `/contact/`.

---

## Advice pages — the long tail

Four informational posts, each catching a question earlier in the journey and handing the reader
to a money page with a descriptive anchor. Not filler: every one answers a question this shop
actually gets asked.

| URL | Long-tail query it targets | Intent | Links down to |
| --- | --- | --- | --- |
| `/advice/check-engine-light/` | what does it mean when my check engine light comes on | Research → emergency | `/services/car-diagnostics/` |
| `/advice/second-opinion/` | should i get a second opinion on a car repair quote | Comparison | `/services/auto-repair/`, `/reviews/` |
| `/advice/central-valley-heat/` | how does hot weather affect your car battery and coolant | Research — seasonal, Central Valley specific | `/services/electrical-repair/`, `/services/oil-change-maintenance/` |
| `/advice/diesel-warning-lights/` | what does the def light mean on a diesel truck | Research → emergency, high-value visitor | `/services/diesel-repair/`, `/services/fleet-services/` |

Two more worth writing once the first four are indexed, both grounded in things the shop can
speak to honestly:

- "Why a trouble code is not a diagnosis" — the shop's whole argument, as a post.
- "What fleet maintenance actually costs when a van goes down on a job site" — aimed at the
  fleet buyer, who is worth far more than a single oil change.

---

## Cannibalisation check

Pairs close enough to collide, and the line drawn between them:

| Pair | Risk | Resolution |
| --- | --- | --- |
| `/` vs `/services/auto-repair/` | Both want "auto repair lodi" | Home targets the **brand + city** head term and ranks on entity signals; the service page targets **"auto repair shop"** and carries the depth. Home links down with the anchor "auto repair", never the other way. |
| `/services/car-diagnostics/` vs `/advice/check-engine-light/` | Both want "check engine light" | Service page owns the **transactional** modifier ("check engine light **lodi ca**"); the advice post owns the **question** ("what does it mean"). The post never mentions a city in its title or H1. |
| `/services/diesel-repair/` vs `/services/fleet-services/` | Diesel work vans overlap both | Diesel = the **engine and its systems**, any owner. Fleet = a **maintenance programme** for a business running several vehicles. Different buyer, different page. |
| `/services/tire-repair/` vs `/services/oil-change-maintenance/` | Both read as "routine" | Tires owns the at-cost pricing story; maintenance owns the interval schedule. No shared head term. |
| `/service-areas/` vs `/` | Both local | Service Areas targets **"near \<other town\>"**, never "lodi" alone. |

---

## Spanish — `/es/`

Lodi and the surrounding Central Valley have a large Spanish-speaking population, and almost no
independent shop in the area publishes in Spanish. One page, `/es/`, carrying the core offer, the
services list, the hours and the phone number.

`hreflang` pairs `en` ↔ `es` ↔ `x-default`, reciprocal on both pages. It is one page rather than
a full mirror on purpose: a half-translated site is worse than a good single page, and the shop
has to be able to answer the phone in Spanish for the page to be worth anything. **Confirm that
before launch** — if nobody at the shop speaks Spanish, this page should not ship.

---

## Utility pages

| URL | Indexable | Notes |
| --- | --- | --- |
| `/thank-you/` | No — `noindex` | Conversion destination. Analytics goal fires here. |
| `/404/` | No — `noindex` | Real navigation, not a dead end: links to services, contact, the phone number. |

---

## What ranks this shop, in order of weight

Honest ordering, because it decides where effort goes after launch:

1. **Google Business Profile.** For "auto repair near me", the map pack sits above every organic
   result. Categories, hours, photos, and a steady trickle of reviews outrank anything on the
   site. The site's job is to be the credible landing page behind it.
2. **NAP consistency.** Name, address and phone identical here, on the GBP, on Yelp, on MapQuest
   and in every citation — down to the punctuation. Currently `103 E Elm St, Lodi, CA 95240` and
   `(209) 647-4953`.
3. **Reviews, continuously.** 83 ratings at 4.4 is real but ageing. A recent review is worth more
   than an old one. The launch checklist includes a short link the shop can text.
4. **The service pages.** Depth and internal linking. This is the part the site controls.
5. **The advice pages.** Slowest to pay, and the reason the site still wins a query in a year.

A 3D hero does not rank. It gets remembered, shared, and it earns the link — and on an auto
repair site in a town of 67,000 it is the reason someone says *"you have to see this shop's
website"*. That is worth building, but it is not the SEO strategy, and nothing about it is
allowed to slow the pages down. Hence every rule in the concept doc.

---

## Meta descriptions, in full

Every remaining page. Checked at ≤ 155 characters with a call-to-action in each, by the script
that generated this table rather than by counting in my head.

| URL | Meta description | Chars |
| --- | --- | --- |
| `/services/auto-repair/` | Full-service auto repair in Lodi, CA for domestic and import vehicles. Honest diagnostics, clear pricing, no upsells. Call (209) 647-4953. | 138 |
| `/services/car-diagnostics/` | Check engine light on? We find the actual fault in Lodi, CA before replacing parts, and show you what we found. Call (209) 647-4953. | 132 |
| `/services/brake-repair/` | Brake pads, rotors, calipers and ABS faults in Lodi, CA. You see what we found and the price before work starts. Call (209) 647-4953. | 133 |
| `/services/engine-repair/` | Engine diagnosis and repair in Lodi, CA - timing, cooling, overheating and rebuilds, quoted before we start. Call (209) 647-4953. | 129 |
| `/services/transmission-repair/` | Transmission service and repair in Lodi, CA. Slipping, harsh shifts or a leak, diagnosed first and quoted up front. Call (209) 647-4953. | 136 |
| `/services/diesel-repair/` | Diesel repair in Lodi, CA for Duramax, Power Stroke and Cummins - engine, fuel system, emissions and driveline. Call (209) 647-4953. | 132 |
| `/services/fleet-services/` | Fleet maintenance in Lodi, CA on a schedule, so a breakdown lands on your calendar instead of a job site. Call (209) 647-4953. | 126 |
| `/services/oil-change-maintenance/` | Oil changes and scheduled maintenance in Lodi, CA. Factory intervals kept, no invented add-ons at the counter. Call (209) 647-4953. | 131 |
| `/services/tire-repair/` | Tires sold at our cost in Lodi, CA - you pay what we pay, plus mount and balancing. Flat repair too. Call (209) 647-4953. | 121 |
| `/services/electrical-repair/` | Car electrical repair in Lodi, CA - batteries, alternators, starters and wiring faults traced properly. Call (209) 647-4953. | 124 |
| `/reviews/` | Real reviews of Phil's Auto and Fleet Repair in Lodi, CA from Yelp and MapQuest, quoted in full with nothing edited. Call (209) 647-4953. | 137 |
| `/about/` | A locally owned repair shop on E Elm Street in Lodi, CA. Who works on your vehicle, and how we quote a job. Call (209) 647-4953. | 128 |
| `/contact/` | Call, email or send us the problem. Phil's Auto and Fleet Repair, 103 E Elm St, Lodi, CA. Open Mon-Sat 8-5. Call (209) 647-4953. | 128 |
| `/advice/check-engine-light/` | What a check engine light actually means, which ones can wait and which mean stop driving. From a Lodi, CA shop. Call (209) 647-4953. | 133 |
| `/advice/second-opinion/` | How to read a repair quote you are unsure about, and what a proper second opinion should include. Lodi, CA. Call (209) 647-4953. | 128 |
| `/advice/central-valley-heat/` | What 100-degree Central Valley summers do to batteries, coolant and tires, and what to check first. Call (209) 647-4953. | 120 |
| `/advice/diesel-warning-lights/` | DEF, DPF and check engine lights on a diesel truck: what each one means and how urgently it needs looking at. Call (209) 647-4953. | 130 |

`npm run check:seo` re-runs this against the **built HTML**, so a description that drifts past
155 while someone is editing copy fails the build instead of shipping truncated in the SERP.
