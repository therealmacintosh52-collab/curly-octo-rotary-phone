# 1. Business truth

Sources, in order of authority: the shop's Google Business Profile as read on 2026-09-24 (services
list, description, ratings, three review snippets, appointments link), Street View photos of the
building, the reviews already verified in `build.py`, and search-engine snippets for competitors
(page fetches were blocked by this environment's network policy, so nothing below is quoted from a
competitor's page). Anything else is `[NEEDS: …]`.

## Positioning statement

Phil's is the Lodi shop that diagnoses before it quotes, and that works on the whole vehicle
population a working household or a small fleet actually owns: the diesel pickup, the cargo van,
the daily driver and the old Cutlass, in one building on East Elm. It sells and installs tires and
rebuilds differentials, so a vibration or a whine is fixed here rather than referred out.

## Two buyer types

| | Owner-driver with a symptom | Fleet or small-business operator |
|---|---|---|
| Trigger | A dash light, a noise, a leak, a dealership quote that felt wrong, or a second shop that replaced a part and the symptom stayed | A van or truck down, a PM schedule that keeps slipping, or a vendor that cannot handle the diesel units |
| Fear | Paying for parts that were guesses; being sold a list; a shop that can't do tires or diffs and sends them elsewhere | Downtime; no single point of contact; a shop that treats a work truck like a commuter car |
| Convincing proof | "Diagnosis first, price before work" stated on every page; Google 4.4 from 83 and CARFAX 4.6 from 26; quotes about fair price and a job done right; the $89 A/C diagnosis, a published number | "Fleet" in the name and on the sign; vans and work trucks visible in the bay; diesel, fleet engine replacement and PM programs on the profile; one phone number that reaches the shop |

## Competitor table

Snippet-level data only. Positioning lines are search-index page titles, not fetched hero copy.

| Shop | Positioning (page title as indexed) | Visual cliché | Conversion weakness | Gap we exploit |
|---|---|---|---|---|
| Lakewood Auto Repair, 201 N Sacramento St | "Expert Auto Repair in Lodi, CA" | `[NEEDS: page fetch]` | `[NEEDS: page fetch]` | Snippets claim "since 1993", "ASE-certified", "same-day service". No diesel, fleet, tires or differential language surfaced. Hours Mon–Thu to 4:30. Phil's is open six days and covers diesel and fleet. |
| Lodi Auto Care | "Auto Repair & Tires in Lodi, CA" | `[NEEDS: page fetch]` | `[NEEDS: page fetch]` | Snippets claim "family-owned", "free estimates", "12-month warranty on parts and labor". Tires overlap with Phil's; diesel and fleet do not. Phil's publishes a diagnosis price instead of "free estimates". |
| Lodi Auto Repair & Smog Inc., 2501 S Stockton St | "Auto Repair – Lodi Auto Repair and Smog Inc." | `[NEEDS: page fetch]` | `[NEEDS: page fetch]` | Snippets claim "since 2008", "12-month warranties", combined technician experience. Smog is their hook. No fleet, differential or new-tire language surfaced. |

Local bar the site must clear: two of three name a 12-month parts-and-labor warranty and one
names ASE certification. Phil's site makes neither claim because neither is verified.
`[NEEDS: warranty terms in months/miles]` and `[NEEDS: technician certifications]` are the two
highest-value missing facts on this site.

Also visible in local results: Joe's Auto Repair, GPS Auto Solutions, Valley Auto Repair Center
(CARFAX 4.9 from 83 per snippet), Cipriano's Diesel Solutions and Shands' Diesel Truck Repair
(diesel query). The diesel specialists are the real competition for fleet work; the generalists are
not.

## Core message and three pillars

**Core message:** *We find out what's actually wrong before you pay for anything.*

| Pillar | Claim | Proof it rests on |
|---|---|---|
| Diagnosis first | Every job starts with testing, and you get a price before work starts | Stated policy on every service page; "Quick diagnostic quick repair and good prices" (Alan F., Google); the $89 published A/C diagnosis |
| The whole vehicle, one shop | Engine, transmission, differentials, diesel, tires and wheels, A/C, electrical, in one building | The Google services list (79 items mapped on `/services/`); a two-post lift, vans and a tire rack visible in the bay; "Fleet" on the sign |
| Fair price, work done right | Customers say so, unprompted | "reasonable price for 60k service" (Eric G.), "a job well done and a fair price" (Anthony P.), 4.4 from 83 on Google, 4.6 from 26 on CARFAX |

## Voice

| Do | Don't |
|---|---|
| "We test before we replace parts." | "Quality you can count on." |
| "A/C diagnosis is $89. You get the findings in writing." | "Affordable prices!" |
| "Sidewall damage can't be repaired safely, no matter who tells you otherwise." | "We offer a wide range of tire services." |
| "A truck that's down is costing somebody money every hour it sits." | "Your trusted partner in fleet solutions." |
| "Call the shop and ask about it by name." | "Contact us today to learn more!" |
| Name the part and the symptom. | Name a feeling. |

## Missing facts, ranked by conversion impact

1. `[NEEDS: warranty terms]` Two of three local competitors advertise 12 months parts and labor. A stated warranty is the single biggest missing trust line.
2. `[NEEDS: confirm phil@philsautoandfleet.com mailbox]` The quote form delivers here. If it does not exist, every form lead is lost silently.
3. `[NEEDS: free tire rotation terms]` The profile promotes it three times. Without conditions the site can only say "ask when you book".
4. `[NEEDS: the 2011–2016 Duramax 6.6 offer]` A model-specific hook for the diesel buyer with no substance behind it yet.
5. `[NEEDS: whether the $89 A/C diagnosis is credited toward the repair]` Changes how the price reads.
6. `[NEEDS: technician certifications, years in business]` A Yelp snippet says "established in 2022"; unverified, so unused.
7. `[NEEDS: tire brands stocked and lead time]` Turns "we sell tires" into a reason to buy here.
8. `[NEEDS: real photos]` The Street View images are Google's. The shot list in `02-visual-world.md` is what to shoot.
9. `[NEEDS: logo at 512 px or SVG]` The 80 px scan is soft on phones and is the source of the color drift that the palette now corrects from the sign.
