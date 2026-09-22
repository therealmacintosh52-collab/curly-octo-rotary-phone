# Shipping site N+1

```
sites/
  _engine/     shared: head, entity graph, sitemap, deploy files, llms.txt, audit
  _standard/   this folder — the bar, the off-site checklist, this runbook
  <business>/  content.py + build.py + assets/ + public/
```

## 1. Scaffold

```bash
mkdir -p sites/<business>/{assets/{css,js,img},tools}
cp sites/starks-hot-chicken/content.py sites/<business>/content.py
```

`starks-hot-chicken` is the better template of the two — it is multi-page,
multi-locale and restaurant-schema'd. `phils-auto-fleet-repair` predates the
engine and still carries its own renderer.

## 2. Fill in `content.py`

Everything the business is, stated once. Mark every fact with provenance —
`[SITE]` read from their own site, `[SEARCH]` from third-party listings,
`[DRAFT]` written copy awaiting owner review. The next person needs to know
which numbers are load-bearing.

Pick `schema_type` honestly: `Restaurant`, `AutoRepair`, `Dentist`, `HairSalon`,
`Plumber`… schema.org has a `LocalBusiness` subtype for most trades, and the
specific one beats the generic.

## 3. Page inventory

One page per query you intend to win. A single page cannot rank for five things.
The pattern that works:

- `/` — brand and entity
- the money page — menu, services, inventory. **All of it in static HTML.**
- one page per major category
- a decision-support page — "which should I pick" beats a brochure page for
  LLM citations
- a neighbourhood/location page with parking, transit, landmarks
- `/faq/`, `/guides/*` — answer-first
- translated landing pages where the local language data supports it. Check the
  actual ZIP-level data; do not assume from the neighbourhood's name.

## 4. Build and audit

```bash
cd sites/<business> && python3 build.py && python3 ../_engine/audit.py public
```

Not done until 0 errors.

## 5. Prove the no-JS property

```bash
python3 - <<'PY'
import re, html
h = open('public/<money-page>/index.html').read()
nojs = re.sub(r'<script.*?</script>', '', h, flags=re.S)
text = html.unescape(re.sub(r'<[^>]+>', ' ', nojs))
for probe in ["<a price>", "<an item name>"]:
    print(probe, probe in text)
PY
```

## 6. Deploy

`netlify.toml` per site (base dir + `python3 build.py`, publish `public`).
GitHub Pages hosts one site per repo, so it stays a staging target.

## 7. Then do the off-site work

`OFFSITE-CHECKLIST.md`. It outweighs everything above.
