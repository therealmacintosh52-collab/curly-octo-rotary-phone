# 6. Launch and docs

## Launch checklist

1. Fill or delete every `[NEEDS: …]` in `build.py`: `grep -n "NEEDS" build.py`. Rebuild. `grep -rn "NEEDS" public/` must return nothing.
2. Confirm `phil@philsautoandfleet.com` receives mail. Submit the quote form once, click the FormSubmit confirmation link, submit again, confirm the table email arrives.
3. `python3 build.py` → deploy `public/` (Netlify drop, or the connected-Git route in `README.md`).
4. Add `philsautoandfleet.com` as the primary domain. Add `www.philsautoandfleet.com`, `philsautofleet.com`, `www.philsautofleet.com`, `philsautoandfleetrepair.com` and `www.` as aliases so the generated redirects fire. Force HTTPS.
5. `curl -I https://philsautofleet.com/diesel-repair` → 301 to `https://philsautoandfleet.com/services/diesel-repair/`. Repeat for `/services/vehicle-inspection`, `/gallery`, `/areas-of-service/lodi-auto-service`.
6. Search Console: add the new domain, submit `/sitemap.xml`; add both old domains and run Change of Address from each. Bing Webmaster: import from Search Console.
7. Google Business Profile: website link → `https://philsautoandfleet.com/`; appointments link → `https://philsautoandfleet.com/contact/#quote`. Re-paste the services list below.
8. Tap every phone link on a real phone. Tap Directions. Tap the form.
9. Keep the old site's files for 30 days.

## Google Business Profile setup

**Primary category:** Auto repair shop. **Secondary:** Diesel engine repair service, Truck repair shop,
Tire shop, Transmission shop, Brake shop, Auto air conditioning service, Auto electrical service,
Oil change service, Wheel store `[NEEDS: confirm the shop wants "Wheel store" listed]`.

**Services to paste, grouped as the site groups them** (this replaces the duplicated list of ~100
lines with the 79 deduplicated items in `build.py` → `CATALOG`; each links to its page):

| Group (page) | Items |
|---|---|
| Engine repair | Engine repair · Auto engine repair · Engine diagnostic · Head gasket replacement · Oil pan gasket replacement · Timing chain replacement · Timing belt replacement · Engine replacement · Overheating diagnosis · Coolant leak diagnosis · Oil leak diagnosis · Vintage / old-school vehicle engine repair |
| Tires & wheels | We sell brand new tires · Brand new tire replacement · Brand new run-flat tires · Tire repair · Tires and wheels · Rim replacement · Tire shop · Free tire rotation (see details) |
| Differentials | Differential diagnosis · Front differential repair · Rear differential rebuild · Differential rebuild · Differential replacement |
| Transmission | Transmission diagnostic · Transmission repair · Transmission rebuild · Transmission maintenance · Driveline and suspension maintenance |
| Diesel repair | Diesel truck repair & maintenance · Diesel repair · Diesel engine diagnosis · Diesel engine repair · Diesel fuel repair · Diesel EGR cleaning · Diesel head gasket replacement · Diesel water pump & timing cover replacement · Diesel suspension repair · Diesel electrical repair · Diesel A/C diagnostic · Diesel maintenance · 2011–2016 Chevy Duramax 6.6 |
| Diagnostics | Vehicle diagnosis · Auto diagnostic · Engine diagnostic · Charging system diagnostic · Full vehicle inspection |
| Auto repair | Auto repair · Auto parts · Vintage / old-school repair · Vehicle maintenance |
| Fleet | Fleet services and repair · Fleet repair and maintenance · Fleet engine repair · Fleet engine replacement |
| Oil change & maintenance | Engine oil change · Oil change · Vehicle maintenance · Spark plug replacement · Cabin air filter replacement (part only, no labor) · Windshield wiper replacement · Full vehicle inspection · Free tire rotation & vehicle inspection |
| Brakes | Brake services · Brake repair · Brake replacement · Performance brake replacement |
| Suspension & steering | Auto suspension repair · Suspension diagnosis · Driveline and suspension maintenance |
| A/C & heating | Auto A/C repair · A/C services · A/C recharge · A/C diagnosis ($89) |
| Electrical | Auto electrical repair · Auto electrical diagnostic · Battery replacement · Charging system diagnostic |

**Description (≤ 750 characters, 712 used):**

> Phil's Auto & Fleet Repair is an independent shop at 103 E Elm St in Lodi, CA. We diagnose before we quote: you get the findings and the price in writing before any work starts. One building covers the whole vehicle — engine, transmission, front and rear differentials, brakes, suspension, A/C, electrical — plus diesel trucks and fleet maintenance for vans and work trucks. We sell brand-new tires including run-flats, replace rims, and offer a free tire rotation with service (ask for details). A/C diagnosis is $89. Domestic, import, diesel, vintage and commercial vehicles welcome. Serving Lodi, Stockton, French Camp, Galt and the surrounding area. Open Monday–Saturday, 8 AM–5 PM. Call (209) 647-4953.

**Ten post ideas** (each is one photo the shop can take, one sentence, one link):

1. Tire rack, "We sell brand-new tires, including run-flats. Quoted for how you drive, not the most expensive on the rack." → `/services/tire-repair/`
2. A rear differential on the bench, "This whine started as a seal. Diagnosis before rebuild." → `/services/differential-repair/`
3. A/C gauge set, "A/C diagnosis is $89, findings in writing." → `/services/ac-heating-repair/`
4. Fleet van on the lift, "PM on your calendar, not on a job site." → `/services/fleet-services/`
5. Duramax in the bay, "2011–2016 Duramax 6.6 owners: `[NEEDS: offer]`" → `/services/diesel-repair/`
6. Free tire rotation callout, "`[NEEDS: terms]`" → `/services/oil-change-maintenance/`
7. Scan tool on a dash, "A code is where we start, not what we replace." → `/services/car-diagnostics/`
8. An old Cutlass or similar in the lot, "Vintage and old-school work welcome." → `/services/engine-repair/`
9. Saturday sign, "Open Saturdays 8–5." → `/contact/`
10. A CARFAX review screenshot, "4.6 from 26 on CARFAX, 4.4 from 83 on Google. Thank you, Lodi." → `/reviews/`

**Review request (SMS or at pickup):**

> Thanks for bringing the `[vehicle]` in today. If we did right by you, a couple of sentences on
> Google helps neighbors in Lodi find an honest shop: `[Google review link]`. If anything wasn't
> right, call me first at (209) 647-4953 and I'll fix it. — Phil's Auto & Fleet Repair

## Citations: NAP block and top 15

Use this block character-for-character everywhere:

```
Phil's Auto and Fleet Repair
103 E Elm St
Lodi, CA 95240
(209) 647-4953
https://philsautoandfleet.com/
```

| # | Listing | Status |
|---|---|---|
| 1 | Google Business Profile | Live. Update website + appointments links |
| 2 | Yelp | Live (`YELP_URL` in build.py is the expected slug; confirm) |
| 3 | CARFAX Service Shop | Live, 4.6 / 26 |
| 4 | Apple Maps (Apple Business Connect) | `[NEEDS: claim]` |
| 5 | Bing Places | `[NEEDS: claim]` |
| 6 | Nextdoor | Live per `PROFILES` |
| 7 | MapQuest | Live per `PROFILES` |
| 8 | Facebook Page | `[NEEDS: URL]` |
| 9 | BBB | Profile exists per search index; `[NEEDS: claim]` |
| 10 | Yellow Pages | `[NEEDS: claim]` |
| 11 | Birdeye | Indexed (4.3 / 75 per snippet); `[NEEDS: claim]` |
| 12 | ChamberofCommerce.com | Indexed (4.4 / 76 per snippet); `[NEEDS: claim]` |
| 13 | Lodi Chamber of Commerce member directory | `[NEEDS: membership]` |
| 14 | RepairPal / Openbay | `[NEEDS: decide]` |
| 15 | Angi / HomeAdvisor (fleet buyers rarely, skip if no capacity) | optional |

Every listing must carry the same name (with "and", not "&", to match Google), the same street
abbreviation and the new domain. Mismatched NAP is the most common local-ranking problem.

## Brand system

Tokens, type scale, motifs, motion and the photo shot list are in `02-visual-world.md`. The
one-line summary: navy sign lettering on white, tan corrugated steel, one brick-red accent, no
gradients, system fonts, work-order ledger lists.

## Owner editing guide

- **Hours, phone, email, rating, areas:** `SITE` at the top of `build.py`.
- **A service page:** its entry in `SERVICES`. `includes` is the checklist, `signs` the symptom list,
  `faqs` the accordion, `callouts` the promo panels.
- **What Google lists:** `CATALOG`. Prices go in `CATALOG_PRICES`; anything without terms in
  `CATALOG_NEEDS` until it has them.
- **Reviews:** `REVIEWS`, verbatim and attributed only.
- **Rebuild:** `python3 build.py`, then deploy `public/`. `python3 tools/make-download.py` refreshes
  the zip. Preview: `python3 -m http.server 8000 -d public`.
- **Photos:** drop into `public/assets/img/`, then swap the `<img>` in `photo_slot()`.

## 90-day measurement plan

| Metric | Source | Day-90 target | If it misses |
|---|---|---|---|
| Calls from the site (`click_to_call`) | GA4 | ≥ 40 / month | Move the number higher on mobile; test a "Call now, open until 5" label |
| Form leads (`generate_lead`) | GA4 + inbox | ≥ 8 / month | Cut the form to name + phone + message |
| GBP calls + direction requests | Business Profile Performance | +25 % vs. prior 90 days | Post weekly; add photos; fix categories |
| Google rating / count | Profile | 4.5 / 100 | Use the review request at every pickup |
| Rankings: "auto repair Lodi", "diesel repair Lodi", "tires Lodi", "differential repair Lodi" | Search Console | Top 5 local, top 10 organic | Expand the weakest page's copy from real jobs; earn one local link (Chamber) |
| Mobile CWV (LCP / CLS) | Search Console CWV report | Green | Ship AVIF hero, keep JS minimal |
| `[NEEDS]` count in `public/` | `grep` | 0 | It is a content problem, not a site problem; call Phil |
