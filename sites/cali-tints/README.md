# Cali Tints — Sacramento, CA

Built from `blueprint/MASTER-BLUEPRINT.md`. Astro 5, plain CSS, video hero,
GSAP + Lenis, self-hosted fonts, JSON-LD, `llms.txt`, IndexNow.

**This is the blueprint's reference implementation** — copied from
`sites/automotive-solutions-v2` (on branch `claude/automotive-solutions-site-fqxf20`),
which superseded `sites/phils-auto-v2`. The blueprint's opening line now points here.
The next site starts with `cp -r sites/cali-tints sites/<slug>`.

```bash
npm install
npm run build          # -> dist/
npm run og             # per-page OG images (run AFTER build)
node scripts/audit.mjs # gate: exits non-zero on any failure
node scripts/lh.mjs    # Lighthouse mobile (prints the table)
npm run contrast       # hero copy vs what is behind it, frame by frame
node scripts/shots.mjs      # QA screenshots -> qa/
npm run scroll-check   # reveals, count-up, before/after images load; screenshots + qa/scroll.mp4
npm run booking-check  # open/closed pill, calendar + slots, service widgets, assistant flow; screenshots
npm run splits         # before/after images from the owner's collage -> public/assets/img/splits/
npm run video -- clip.mov   # encode a new hero clip to spec + recut posters
npm run posters        # hero poster set only (jpg/webp/avif)
node scripts/preview-relative.mjs   # -> dist-preview/ (sub-path safe)
node scripts/indexnow.mjs --send    # push the sitemap to Bing
```

Every business fact lives in `src/data/site.json`. Adding a service or a guide is
a data change plus `npm run build && npm run og`.

## Before/after images and scroll motion

**Before/after images.** The owner supplied an AI-generated collage of thirteen
before | after tiles (`src/assets/source/before-after-collage.jpg`, 1792×1008).
`npm run splits` (`scripts/split-images.mjs`) cuts tiles 1–11 into one image per
service: the largest 2:1 rectangle below the baked-in BEFORE/AFTER words and above
the label strip, centred on the tile's own divider, upscaled to 1280×640 and
written to `public/assets/img/splits/<slug>.{jpg,webp}`. The van in the
commercial-wraps tile carried another company's mark; the script paints over it
with the Cali Tints badge, name and phone number. Tiles 12 (dent repair, not a
service any more) and 13 (headlight restoration, not a service) are skipped. A
service can instead point at a full-size standalone split image in
`src/assets/source/` (`STANDALONE` in the script; detailing uses
`detailing-interior.jpg`), which is cropped to 2:1 around its divider and scaled
down rather than up.
`SplitImage.astro` shows the image with our own Before/After pills and a centre
line; `services[].image` in `site.json` holds the path, alt text and caption.
Every caption says "AI-generated illustration, not a customer vehicle." The earlier
drag slider was retired: a slider needs the same framing twice, and each tile's
halves show different halves of the car. Each service page also has a two-column
text difference (`Difference.astro`, from `services[].difference`). Three compact
images sit on the home page.

**Everything else that moves.** Section heads, page heads, split columns, panels,
the glance card, reviews and FAQs fade up as they enter; checklists and card
grids stagger; the stat band's 4.9 / 48 / 11 count up once. All of it is GSAP,
loaded after `load`, skipped under `prefers-reduced-motion`, and nothing is
hidden until the motion chunk has loaded, so CLS stays 0.
`npm run scroll-check` verifies the count-up and reveals, checks the before/after
images load, and records `qa/scroll.mp4`.

**To replace a tile with real photos**: save the pair as one image (before on the
left, after on the right, divider in the middle, at least 1280×640) in
`src/assets/source/` and add it to `STANDALONE` in `scripts/split-images.mjs`;
change that service's `image.caption` in `site.json` from the illustration wording to
the real one.

## Booking, the assistant and the social bots

Three things were added for "book first, call always": an online booking page,
an assistant that sells the services and books, and the same assistant wired for
Instagram and Messenger. Every one of them keeps a call button in view, and the
button knows whether the shop is open right now (`src/lib/hours.ts`, from
`site.hours_open`, in the shop's time zone, refreshed every minute).

### Booking (`/book/`)

`src/data/site.json → booking` decides the mode.

**Mode A, recommended: the owner's own calendar app.** Set `booking.provider_url`
to a shareable booking page and `/book/` embeds it; every booking then lands in
the app the owner already carries:

| Provider | Cost | Where bookings show up | How to get the link |
|---|---|---|---|
| Google Calendar appointment schedule | free with a Google account | Google Calendar app, with automatic confirmation and reminder emails | calendar.google.com → Create → Appointment schedule → hours and durations → Share → copy link |
| Square Appointments | free tier | Square Appointments app; also gives Instagram and Facebook a native "Book" button | squareup.com/appointments → online booking → copy link |
| Calendly | free tier | Calendly app | calendly.com → event type → copy link |

**Mode B, shipped today: the built-in request flow.** With `provider_url` empty,
`BookingCalendar.astro` + `src/scripts/booking.ts` draw a calendar for the next
`weeks_ahead` weeks, enable open days, list start times inside business hours
(long jobs such as wraps and coating are morning drop-offs), and send the
request through the same FormSubmit endpoint as the quote form. The email to the
shop carries a one-tap "add to Google Calendar" link with the service, date,
time, vehicle and note already filled in, so the owner can put it on their
phone's calendar without typing. The customer also gets "text this to the shop"
(an SMS link with the request written out), "add to my calendar" (.ics) and,
during business hours, a "call now" button. Until `site.email` is real and the
FormSubmit address is activated, the form says it is not connected and the
customer is pointed at the text and call options; nothing is silently lost.
Anything on the site can prefill it: `/book/?service=<slug>&note=<text>`.

### The assistant (bottom-right corner, every page)

`Assistant.astro` + `src/scripts/assistant.ts`. Two brains:

- **Guided flow, no server.** Keyword intents (service, price, hours, legal,
  book, call), a short question path (service → vehicle → goal), answers taken
  from `site.json`, and every reply ends in "Book" and, when the shop is open,
  "Call". This is what runs on GitHub Pages and whenever Claude is not configured.
- **Claude.** `netlify/functions/chat.mjs` → `netlify/lib/engine.mjs` runs a
  turn on Claude Opus 5.5 (override with `ASSISTANT_MODEL`) with the system
  prompt and tools in `netlify/lib/knowledge.mjs`: `check_open_now`,
  `booking_link`, `service_details`. The widget probes the endpoint once; if it
  answers `{llm:true}` messages go to Claude and the reply's buttons are
  rendered. The function sets server-side refusal fallbacks on by default and
  caches the system prompt. Rough cost: a few cents per conversation.

To turn Claude on: host on Netlify (connect the repo; `netlify.toml` already
points at the functions folder), then Site settings → Environment variables →
`ANTHROPIC_API_KEY` from console.anthropic.com. Redeploy. Nothing else changes.

### Instagram and Messenger bot

`netlify/functions/meta-webhook.mjs` answers DMs with the same engine, keeping
the last twenty turns per sender in Netlify Blobs. Setup, all on the owner's
accounts:

1. The Instagram account must be a professional account linked to a Facebook
   Page. On the Page, Settings → Messaging → allow access via API.
2. developers.facebook.com → My Apps → Create app (Business) → add the
   **Messenger** and **Instagram** products.
3. Messenger settings → connect the Page → generate a Page access token with
   `pages_messaging`, `pages_manage_metadata`, `instagram_basic` and
   `instagram_manage_messages`.
4. Webhooks → Callback URL `https://<site>/.netlify/functions/meta-webhook`,
   Verify token: any password you make up; subscribe to `messages` for both
   the Page and the Instagram account.
5. Netlify environment variables: `META_VERIFY_TOKEN` (the password from step
   4), `META_APP_SECRET` (App settings → Basic), `META_PAGE_TOKEN` (step 3),
   `ANTHROPIC_API_KEY`. Redeploy; Meta's verification call then succeeds.
6. Until the app passes App Review, only the app's admins and testers can DM
   the bot. Submit for `instagram_manage_messages` and `pages_messaging` with a
   screen recording of a booking conversation.

Quicker win that works today: Instagram profile → Edit → Action buttons →
**Book now** → paste `https://<site>/book/`; Facebook Page → Add action button →
Book now → same link. With Square as the booking provider the Book button is
native. Without an API key the webhook still replies with hours, the phone
number and the booking link.

### Interactive service pages

`Interactive.astro` + `src/scripts/widgets.ts`, configured per service by
`services[].interactive` in `site.json`: shade slider (tint), colour and finish
picker (wraps), name-on-the-van (fleet), tap-the-panels (PPF), years-of-ownership
comparison (ceramic), stage picker (correction), checklists (detailing,
customization, upholstery) and symptom chips (removal, inspections). Each one
writes a one-line "Your pick" and carries it into the Book button as the note.
`npm run booking-check` exercises all of it.

## Preview on GitHub Pages

`.github/workflows/deploy-phils-site.yml` builds this site on every push to the
listed branches and publishes it **under `/cali-tints/`** on the repo's Pages
site (Phil's Auto keeps the root; a repo has one Pages site):

    https://therealmacintosh52-collab.github.io/curly-octo-rotary-phone/cali-tints/

It uses the relative-URL copy from `scripts/preview-relative.mjs`, so every link,
font, poster and the video resolve from the sub-path. One-time setup by the repo
owner: **Settings → Pages → Build and deployment → Source: GitHub Actions.** Until
that is set the `deploy` job fails in a second with "Get Pages site failed".

Pages is the shareable preview, not production: it cannot serve `_headers` or
`_redirects`, and the canonical URLs still point at `calitintsca.com`. Production
is Netlify (base directory `sites/cali-tints`, build `npm run build`, publish `dist`).

---

## Where things are

```
src/data/site.json      all business facts: 11 services, 5 guides, 3 reviews,
                        6 FAQs, 10 areas, the three home pillars, profile URLs
src/lib/seo.ts          schema builders. @type = LocalBusiness + knowsAbout
src/lib/hours.ts        open/closed maths in the shop's time zone (pill, calendar, assistant)
netlify/functions/      chat.mjs (site assistant), meta-webhook.mjs (Instagram + Messenger)
netlify/lib/            knowledge.mjs (prompt + tools from site.json), engine.mjs (Claude turn)
src/layouts/Base.astro  head, preloads, JSON-LD, chrome
src/components/         VideoHero, SplitImage, Interactive, BookingCalendar, Assistant, OpenNow, …
src/assets/source/      before-after-collage.jpg, the owner's collage that npm run splits cuts up
src/scripts/site.ts     nav, tracking, forms, hero autoplay, GSAP/Lenis
src/styles/legacy.css   tokens + components (green/black, contrast-verified)
src/styles/global.css   @font-face, video hero, motion, At a glance, Short answer
public/fonts/           self-hosted woff2 — never a runtime CDN
public/assets/video/    shop.mp4 + shop.webm (the hero clip)
public/assets/img/      logo.png (256), logo-800.png, apple-touch-icon.png,
                        favicon.svg, hero-poster.{jpg,webp,avif}
public/assets/img/splits/   <slug>.{jpg,webp}, generated by npm run splits
scripts/                build, audit, perf and asset tooling
qa/                     screenshots (gitignored; regenerate with shots.mjs)
```

## Scores

`node scripts/lh.mjs`, throttled mobile, against the built `dist/`: home 96, service 99,
guide 99, contact 100 performance; 100 accessibility / best practices / SEO; CLS 0
(2026-09-25). `node scripts/audit.mjs` passes with 0 errors
and 0 warnings across 26 pages: one H1 each, heading order, unique titles ≤ 60
and descriptions 70–160, valid JSON-LD with no aggregateRating, every internal
link and anchor resolving, alt text everywhere, one phone number everywhere,
sitemap coverage, and text contrast measured against the background each
element renders on. `npm run contrast` reads 7.32:1 on every frame of the clip
(needs 4.5:1), and the number is identical frame to frame, which is the proof
that nothing is laid over the video.

---

## What was assumed, and where it came from

Nothing on the site is invented, but most of it came from public listings and the
owner's pasted Google card rather than from the shop directly. Confirm each before
launch. The launch checklist, keyword map and marketing plan are kept with the
owner, outside this public repository (`marketing/`, `seo/` and `perf/` are gitignored).

| # | Item | Source | Action |
|---|---|---|---|
| 1 | **Shop email** | Not published anywhere | **Blocking.** Set `site.email`, rebuild, click the FormSubmit confirmation. Until then the form tells visitors to call rather than pretending to send. |
| 2 | Name, address, phone | Google card pasted by the owner, 2026-09-25 | Settle `# F` (Google) vs `Suite F` (this site) one way, everywhere |
| 3 | **Hours: Monday – Friday 10:00 AM – 6:00 PM, Saturday 10:00 AM – 4:00 PM, closed Sunday** | Owner's choice; matches Google "closes 6 PM" and two directories. **Yelp says Monday – Friday 10:00 AM – 7:00 PM, Saturday 11:00 AM – 5:00 PM.** | Confirm; fix whichever listing is wrong |
| 4 | 4.9 from 48 Google reviews | The Google card, read 2026-09-25 | Re-read before launch; update `rating` / `review_count` / `rating_checked` |
| 5 | Three quoted reviews | The three snippets on the Google card, verbatim, reviewer names as shown | Add a fourth; the blueprint asks for four |
| 6 | Eleven services | Owner's 11-category list + the Google listing's service list, minus dent removal (dropped 2026-09-26 at the owner's request) | Confirm "inspections & mechanical" is work the shop wants to advertise |
| 7 | Domain `calitintsca.com` | Search result; the site could not be crawled from here | Confirm, and whether `www` is canonical |
| 8 | Redirects | Old page list unknown | **Fill `public/_redirects` from Search Console before launch** |
| 9 | Instagram | The Google card links one; URL not visible | Add to `profiles` in `site.json` |
| 10 | Geo 38.5995, −121.4014 | Geocoded from the street address | Fine-tune from the listing |
| 11 | Ten towns served | Neighbouring cities, nearest first | Confirm the shop wants all ten |
| 12 | Film brands, warranty terms | Not published | Add to the tint and PPF pages once named — strong content |
| 13 | "Cali Tints Revolutions" | Owner's draft copy | Left out. If it is a real product line, name the film and what it rejects |
| 14 | Photos | None supplied | Storefront, the bay, finished cars — and real before/after pairs to replace the AI illustrations |
| 15 | California tint law figures | CA Vehicle Code §26708: 70% VLT front sides, AS-1 strip, any shade rear, dual mirrors, medical exemption | Stable, but re-check yearly; the guide says it is not legal advice |

## Decisions that differ from the blueprint

1. **`LocalBusiness`, not `AutoRepair`.** Window tinting has no schema.org
   subtype and this is not a repair shop. Per the blueprint's own "anything else"
   row: `LocalBusiness` + `knowsAbout[]` + `hasOfferCatalog`.
2. **No `aggregateRating` in the JSON-LD.** Carried over from the reference:
   Google treats self-marked-up ratings as self-serving and can drop the rich
   result. The rating is plain text linked to the listing, and `scripts/audit.mjs`
   fails the build if `aggregateRating` ever appears.
3. **Three reviews, not four.** Three verbatim quotes exist. A fourth was not
   invented. One of the three includes a criticism about pickup timing; it stays.
4. **No 3D island, no `/es/`.** The clip is the hero; WebGL would cost LCP and
   win nothing. No second language was listed on the intake, so the Spanish page
   was not built and the schema declares `knowsLanguage: ['en']`.
5. **A `pillars` block in `site.json`.** The owner supplied three paragraphs
   (Tints / Wraps-PPF / Detail-Ceramic). They became a three-card section on the
   home page above the eleven-service grid, driven from data like everything else.

---

## Brand

The palette is sampled from the badge logo: leaf green `#80d850` inside a black
disc with a grey ring `#686868`. That green is too light to carry text on white
(1.9:1), so:

- `--accent` / `--accent-dk` are darker greens (`#2a7a1a` 5.4:1, `#1f6b12` 6.6:1)
  for buttons and link text on white;
- `--accent-vivid` (`#80d850`) and `--accent-lt` (`#9be86a`, 13:1 on the dark
  ground) carry eyebrows, icons and the H1 highlight on dark sections;
- the darks are neutral black with a faint green cast (`--ink #0b0f0b`), not the
  reference's indigo.

Everything is a custom property in `src/styles/legacy.css` `:root`; the OG and
poster scripts carry their own copies of the gradient and were updated to match.

The logo is round, so the header and footer use the badge beside the name
(`.brand-badge` + `.brand-text`). The name is set the way the badge sets it —
uppercase display type in the logo green on a black band with the grey ring
(`.brand-word`) — so the header reads as the logo rather than as a caption next
to it; the footer inverts it to black on green. Hours and day names are never
abbreviated anywhere on the site (owner's instruction): `hours_short` in
`site.json` is the full string and every component reads it.
`logo.png` is 256 px for the header; `logo-800.png` is the master and feeds the
manifest and the JSON-LD `logo`. Both were cut from the supplied JPG with the
white ground made transparent. An SVG from the owner would be better.

Fonts: Space Grotesk + Inter, the blueprint's pairing for auto and trades,
already self-hosted in `public/fonts/` with metric fallbacks.

---

## The hero video

**In and live.** `public/assets/video/shop.mp4` (1.63 MB) + `shop.webm` (1.81 MB),
the full 6.9 s, silent, encoded with `npm run video` from the owner's `.mov`
(1280×720 H.264 + AAC source). **No trim.** Posters are cut from frame 1.

### What is in the footage

It is AI-generated, not the real shop, and shipped whole by the owner's decision.
Recording what is on screen so nobody rediscovers it:

- A technician kneels beside a **black BMW 2-series coupe** with a machine
  polisher — a **detailing / paint-correction scene, not a tint install**. The
  polisher's body reads "CALI TINTS".
- The **green palm-tree badge**, matching the real logo, glows on the wall
  **top-centre** of the frame. It is the most on-brand thing in the clip and the
  reason the band runs uncropped.
- Sunset, corrugated steel building, roll-up doors. **No phone number, no
  address, no street sign** anywhere in frame — nothing contradicts the site.
- The camera holds; the loop is a slow drift. First and last frames are near
  enough that the hard loop does not jump.

Ten seconds shot in the real bay would replace it and add the real storefront:

```bash
npm run video -- ~/real-clip.mov     # + --start/--end/--speed/--pingpong if raw
npm run build && npm run og && node scripts/audit.mjs && npm run contrast
```

`hasVideo={true}` and `focus="50% 30%"` are already set in `src/pages/index.astro`.

### How it behaves

Inherited from the reference, unchanged:

- The band is `aspect-ratio: 16 / 9`, the clip's own ratio, so `object-fit: cover`
  crops nothing and the badge is on screen at every width. `focus` only governs
  the poster if the ratio is ever changed. On a 1440×900 laptop the frame is
  810 px tall and the headline sits below the fold; the sticky header keeps the
  phone number and *Get a Quote* on screen, and the mobile call bar does the same
  on phones, where the frame is 219 px tall and the call button is above the fold.
- Nothing is laid over the clip. The copy sits on the dark gradient beneath it.
  `npm run contrast` is the regression test: identical numbers frame to frame.
- The poster is a real `<img>`, preloaded, so it is the LCP; the video source is
  attached after `load`. `muted` is set in JS as well as markup; `play()` is
  retried on `canplay`, `loadeddata`, `pageshow`, visibility change and the first
  gesture. If it is still refused (iPhone Low Power Mode), the poster stays and a
  "Tap to play" pill appears. The video pauses off-screen.
- WebM/VP9 first, H.264 MP4 second, negotiated with `canPlayType`. The headless
  Chromium in this container has no H.264 decoder, which is why the WebM is what
  makes the autoplay path testable here.

### Verified

| | Result |
|---|---|
| Autoplay, default Chrome policy | plays, `readyState 4`, `is-playing` set |
| Autoplay refused (`--autoplay-policy=user-gesture-required`) | poster stays, tap cue shown, no false "playing" |
| Hero copy vs the brightest pixel behind it, every second (`npm run contrast`) | worst 7.32:1, needs 4.5:1, identical at every frame |
| Audio | stripped (`-an`) |
| Horizontal overflow at 390 px | none |

---

## Only the owner can do these

1. Supply the email, then click the one-time FormSubmit confirmation link.
2. Confirm the hours and fix whichever of Google or Yelp is wrong.
3. Export the old site's URLs and fill the redirect map.
4. Update the Google Business Profile — categories, all eleven services, photos,
   website link — and make name/address/phone/hours match this site exactly.
5. Supply photos and, when convenient, a real clip of the bay.
6. Name the films installed and their warranty terms.
7. Ask customers for reviews, using the review-request templates in the private playbook.
