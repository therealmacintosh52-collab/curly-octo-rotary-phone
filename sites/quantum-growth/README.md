# Quantum Growth — the agency site

One static page. No build step, no framework, no dependencies.

## Deploy

```bash
python3 set-domain.py yourdomain.com     # stamps canonical, OG and schema
# then upload public/ to Cloudflare Pages and attach the domain
```

`set-domain.py` is not optional. Canonical tags, Open Graph URLs and the
schema `@id` all carry an absolute domain; shipping the placeholder tells
Google the page lives somewhere else.

## What is in the head

- Meta description, canonical, robots, theme-color
- Open Graph and Twitter card
- `ProfessionalService` schema — name, phone, founder, service types, and all
  four plans as priced offers
- `FAQPage` schema built from the ten questions on the page, so it can earn
  rich results
- `WebSite` schema

The FAQ schema is generated from the page copy rather than written twice, so
the two cannot drift apart. If you edit a question or answer in the HTML,
regenerate the block rather than hand-editing the JSON.

## Still missing before this converts

- **Social proof.** No testimonials, case studies or client names. This is the
  ceiling on the whole page and no rewrite fixes it — one client with real
  before-and-after numbers does.
- **A face.** The one-person section carries the logo mark. Deciding whether to
  put a real name and photo on it is a live trade-off: anonymity looks bigger,
  a name converts better and is the thing the incumbent cannot offer.
- **An OG image.** Links currently share without a preview card.
- **The competitor prices** in the plan cards ("Others charge $1,000 + $99/mo")
  come from a single sales call. Confirm before treating them as fact.

## Do not expect this to rank

It is one page for a nationwide business, competing against every agency in
the country. The head tags stop it looking like a hypocrite selling schema
markup, and they help it show up when someone searches the business by name.
They will not win competitive terms. Traffic has to come from somewhere else.

## Careful when editing

`public/index.html` is the source of truth. The head — meta, canonical, Open
Graph and the three schema blocks — lives only in this file. Overwriting it
with a copy from anywhere else silently drops all of it, which has happened
once. If you regenerate the page, re-add the head, and check with:

```bash
python3 -c "import re,io;print(len(re.findall(r'ld\+json', io.open('public/index.html',encoding='utf-8').read())))"
```

Three is correct. Zero means the head is gone.
