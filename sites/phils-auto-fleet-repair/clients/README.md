# The client factory

One JSON file per shop. The 2,500-line copy library in `build.py` is shared by
all of them — which is the whole economic point: site #2 costs what site #200
costs.

## Adding a shop

```bash
python3 newclient.py \
    --name "Ridgeline Auto Care" --domain ridgelineautocare.com \
    --phone "(209) 555-0142" --email service@ridgelineautocare.com \
    --street "418 W Harding Way" --city Stockton --region CA --zip 95204 \
    --areas "Stockton,Lodi,Manteca,Lathrop" --saturday

python3 build.py --client ridgeline-auto-care   # -> ./public
python3 build.py --all                          # every client -> ./dist/<slug>/
python3 build.py --lint                         # fails if a client carries another's copy
```

## Before a site goes live

`newclient.py` deliberately leaves these empty rather than guessing. A wrong
address or an invented rating is the one mistake that costs the Google listing.

| Field | Where it comes from |
|---|---|
| `lat` / `lng` | Right-click the pin in Google Maps |
| `rating`, `review_count` | The live Google listing. Never estimate |
| `reviews` | Real, attributed, verbatim. Never write these |
| `profiles` | Yelp / Nextdoor / MapQuest / Carfax URLs from each dashboard |
| `logo` | Drop the file in `public/assets/img/`, then set the path |

## How localization works, and what it can't do

The copy library was written for one real shop and still names it in ~150
places. Every rendered page passes through a find-and-replace mapping that
shop's literals onto the client being built — name, short name, city, street,
ZIP, phone, email, domain, service-area towns, rating phrases. For the
reference client every pair is identical, so the pass is a no-op and its output
is byte-for-byte unchanged.

It fixes identity mechanically. It cannot fix regional colour: a guide about
Central Valley summer heat reads oddly for a shop in Maine. That is what
`--lint` is for — it fails on any reference literal that survived, giving you
the exact list of sentences to rewrite. Recurring geography (highways, county
names) goes in `region_swaps`:

```json
"region_swaps": { "Highway 99": "I-5", "San Joaquin": "Whatcom" }
```

Run `--lint` before every handoff. A site that ships carrying the previous
client's town name is the one failure that ends the referral.
