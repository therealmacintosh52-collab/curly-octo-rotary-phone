# Keyword map — one family per URL

One keyword family per page. Where two pages could plausibly target the same
phrase, the winner is named and the loser links to it. That is what stops the
home page and the main service page competing with each other.

**City modifier:** every commercial page targets `… in Elk Grove` / `… Elk Grove CA`.
The guides deliberately do not — they target the question, not the town, because
that is how people search before they are ready to call.

## Commercial pages

| URL | Primary | Close variants | Notes |
|---|---|---|---|
| `/` | auto repair Elk Grove CA | mechanic Elk Grove, auto shop near me Elk Grove | Brand + category. Does **not** target "auto repair shop in Elk Grove" — that is `/services/auto-repair/`'s phrase. |
| `/services/` | auto repair services Elk Grove | car services Elk Grove, what we fix | Hub. Exists to pass authority down; no standalone phrase of its own. |
| `/services/auto-repair/` | auto repair shop in Elk Grove CA | car repair Elk Grove, domestic and import repair | **Cannibalization watch:** closest page to the home page. Home owns the brand query, this owns the service query. |
| `/services/brake-repair/` | brake repair Elk Grove CA | brake pads Elk Grove, brake service near me | |
| `/services/engine-repair/` | engine repair Elk Grove CA | engine replacement Elk Grove, major overhaul | |
| `/services/transmission-repair/` | transmission repair Elk Grove CA | transmission replacement Elk Grove | |
| `/services/ac-repair/` | car AC repair Elk Grove CA | auto air conditioning Elk Grove | Seasonal: peaks late May–August. |
| `/services/car-diagnostics/` | check engine light Elk Grove | car diagnostics Elk Grove, OBD scan | **Watch:** overlaps `/advice/check-engine-light/`. This page owns the *transactional* phrase ("… Elk Grove"), the guide owns the *informational* one ("what does it mean"). |
| `/services/electrical-repair/` | auto electrical repair Elk Grove | alternator, starter, battery Elk Grove | |
| `/services/suspension-steering/` | shocks and struts Elk Grove CA | suspension repair Elk Grove | |
| `/services/timing-belts/` | timing belt replacement Elk Grove | timing belt cost Elk Grove | **Watch:** overlaps `/advice/timing-belt-or-chain/`; same split as above. |
| `/services/fuel-injection/` | fuel injection service Elk Grove | tune up Elk Grove | |
| `/services/oil-change-maintenance/` | oil change Elk Grove CA | scheduled maintenance 30k 60k 90k | Highest-volume, lowest-value query. It is a front door, not a profit centre. |
| `/services/wheel-balancing/` | wheel balancing Elk Grove | tire rotation Elk Grove | |
| `/about/` | Automotive Solutions by Single | family owned mechanic Elk Grove | Brand + entity. |
| `/reviews/` | Automotive Solutions Elk Grove reviews | is Automotive Solutions good | |
| `/service-areas/` | auto repair near Laguna / Wilton / Galt | mechanic near me south Sacramento | Do **not** build one page per town unless there is real content for each — thin doorway pages get filtered. |
| `/contact/` | Automotive Solutions phone number / directions | auto repair 9253 Elk Grove Blvd | |

## Informational pages (the guides)

| URL | Primary question | Why it exists |
|---|---|---|
| `/advice/independent-shop-warranty/` | does using an independent shop void my warranty | Highest-intent objection the shop faces. Answers it with the actual law (Magnuson-Moss). Nothing else in the local market answers this. |
| `/advice/check-engine-light/` | what does my check engine light mean | Largest informational volume in the niche. Feeds `/services/car-diagnostics/`. |
| `/advice/car-ac-not-cold/` | car ac not blowing cold | Seasonal spike, feeds `/services/ac-repair/`. |
| `/advice/timing-belt-or-chain/` | timing belt or chain, when to replace | Feeds `/services/timing-belts/`, the shop's listed specialty. |
| `/advice/repair-or-replace/` | is this repair worth it on an old car | Catches the big-ticket decision moment. Feeds engine and transmission pages. |

## Internal linking rules

1. Every guide links to its matching service page at least once in the body.
2. Every service page links to 7 sibling services plus the services hub.
3. The home page links to all twelve services and to `/reviews/`, `/about/`, `/service-areas/`.
4. Nothing links to `/thank-you/` or `/privacy/` from body copy; footer only.

## Titles and descriptions

- Title pattern: `[Service] in Elk Grove, CA | Automotive Solutions`, trimmed to ≤ 60 characters.
- Description: ≤ 155 characters, contains the phone number.
- Both are enforced by `scripts/audit.mjs`, which fails the build on a duplicate
  or an out-of-range length.

## Not targeted, deliberately

- Anything implying a price the shop has not published. No "cheap", no "$X oil change".
- Smog *certification* — the shop diagnoses smog failures but nothing verifies it
  is a licensed STAR test-and-repair station. Do not target it until confirmed.
- Fleet or diesel. That is the other shop in this repo; this one has not claimed it.
