# FD26 — Real Product Photos Playbook

Owner verdict 2026-06-11: current product images read as fake/scammy —
**replace with real photographs.** Each live product has only 2–3
app-imported images (the import trim deleted the rest; nothing usable
left in Shopify Files — verified via `files` query).

Agent cannot fetch images directly: container egress allowlist blocks
image downloads, and WebFetch gets HTTP 403 from Faire, Amazon, and
Shopify storefronts. WebSearch works. **Shopify itself fetches any
public HTTPS image URL server-side**, so once a URL or an
admin-uploaded file exists, attaching it is trivial.

## Route 1 — tonight, before the June 12–13 cutoff (owner, ~10 min)

The Zendrop and CJ apps still hold the **full original photo galleries**
(typically 6–12 images incl. real in-hand/lifestyle shots) for these
exact listings:

| Product | Source app | Where |
|---|---|---|
| Muscle Massage Gun (ETMMG2060) | Zendrop | My Products → edit → media → push all images to store |
| Instant-Read Thermometer (B0CL5XT968) | CJ | My Products → edit → sync images to store |
| Multi-Tool Hammer Hatchet (PF10) | Zendrop/CJ | same |

Alternatively drag-and-drop into Shopify admin → Product → Media.
After re-push, agent re-trims to the best real shots and sets alt text.

## Route 2 — find the same product elsewhere (reverse image search)

Free tools, owner's browser (agent is bot-blocked on all of these):

- **Google Lens** (lens.google.com, or right-click an image in Chrome →
  "Search image with Google") — best at finding the *exact* item on
  Amazon/eBay/AliExpress with full galleries.
- **AliExpress / Alibaba camera search** (in-app) — finds the same
  factory item.
- **Bing Visual Search**, **TinEye** (exact-match / original source).
- **Koala Inspector / PPSPY** (Chrome ext.) — extract images + supplier
  info from any competitor Shopify store.

Same-product sources already located by SKU:
- Massage gun: wholesale listing on Faire — `faire.com/product/p_8fw86nhwv4`;
  also sold at `pulseprecisionpro.com/products/muscle-massage-gun`.
- Thermometer: SKU is an Amazon ASIN — `amazon.com/dp/B0CL5XT968`.
- Hatchet: find via Google Lens on the current lead photo.

Use marketplace photos only as *reference* to locate the supplier's own
gallery — supplier/app galleries are the ones licensed for resale use.

## Route 3 — genuinely original photos (post-cutoff upgrade, best ROI)

Order one sample of each (landed: $19.80 + $14.03 + $20.64 ≈ **$54**),
arrives ~5–7 days (after the FD cutoff — this is a campaign-week+1 task):

- DIY: phone photos in daylight, white poster board, 5+ angles + one
  in-hand shot. Kills the scam look permanently and feeds ad creative.
- Or hire a product photographer on Upwork ($50–150/product) — agent
  can draft the job post on request (master doc §8 thresholds apply).

## Handoff back to agent

Once images exist (re-pushed via apps, uploaded in admin, or public
URLs pasted in chat / emailed to [contact email — kept out of this public repo]), the
agent attaches/orders/trims them and sets alt text via `update-product`.
