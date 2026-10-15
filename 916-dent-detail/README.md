# 916 Dent & Detail

Mobile paintless dent repair + detailing site for Sacramento. Next.js 16 (App Router, TypeScript strict),
Tailwind v4, GSAP + ScrollTrigger + Lenis. Owner spec: [`SPEC.md`](SPEC.md). Assumptions: [`DECISIONS.md`](DECISIONS.md).
Open items: [`TODO.md`](TODO.md).

**Status:** Phase 1 (scroll-scrub hero + marketing site) and Phase 6 (SEO + local) built locally. Not deployed. Nothing is live.

## Run it

Requires Node 20.9+ (built on Node 22). No API keys needed for Phase 1.

```bash
npm install
npm run dev            # http://localhost:3000 (dev mode, slower, no perf numbers)
npm run build && npm start   # production build on :3000 (use this for Lighthouse)
```

Optional: `cp .env.example .env.local` and set `NEXT_PUBLIC_SITE_URL` once the domain exists.
Opt out of Next.js telemetry with `npx next telemetry disable` or `NEXT_TELEMETRY_DISABLED=1`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server on :3000 |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint (next core-web-vitals + typescript) |
| `npm run verify` | typecheck + lint + build |
| `npm run media` | Regenerate every image/video asset in `public/` from `brand/` (needs `ffmpeg`, `ffprobe`). Steps can run alone: `node scripts/media.mjs logo favicons og video frames beading manifest` |
| `bash scripts/subset-fonts.sh` | Re-create the subset Michroma/Inter woff2 files in `src/fonts/` from the `@fontsource` packages (needs `pip install fonttools brotli`) |
| `npm run check:content` | Word-count + 5-word-shingle Jaccard similarity gate for services, cities, posts (also runs as `prebuild`; fails >35% overlap) |
| `npm run check:seo` | Starts the production server (builds if needed), crawls every internal link and asserts h1/title/description/canonical/OG/JSON-LD/sitemap/redirect/404 rules. `--no-build`, `--port=`, `--base=` supported |
| `node scripts/qa-seo.mjs [url] [outDir]` | axe + mobile/desktop screenshots of a service, city, blog and hub page |
| `npm run check:owner` | Launch gate: lists every `[OWNER]` placeholder left in `src/`; exits 1 while any remain |
| `node scripts/shots.mjs [url] [outDir] [--reduced]` | Playwright screenshots, mobile 390x844 + desktop 1440x900, hero at 0/35/70/100% and every section |
| `node scripts/axe.mjs [url]` | axe-core audit of every route (mobile, desktop, reduced motion); exits 1 on serious/critical |
| `CHROME_PATH=... node scripts/lh.mjs [url] [outDir] [--desktop] [--runs=N]` | Lighthouse (mobile preset by default), prints a score table |

Shots/axe use Playwright 1.56 browsers: set `PLAYWRIGHT_BROWSERS_PATH` if they are not in the default cache.

## Layout

```
brand/                 source assets from the owner (logo.jpg, hero-beading.png, hero-video.mp4)
public/                generated assets (do not hand-edit; run `npm run media`)
  brand/               logo-transparent.png, d-mark*.png/webp
  hero/m, hero/d       121 WebP scrub frames (mobile 720x1280, desktop 720x1000 crop)
  hero/poster-*, static-*   frame 0 (LCP poster) and last frame (reduced-motion state), AVIF + WebP
  beading/             hero-beading in 2 sizes + blurred/darkened backdrop
scripts/               media pipeline, font subsetting, QA scripts
src/app/               routes: / /services /dealers /pricing /reviews /book + 404, layout, fonts, manifest
src/components/        Header, Footer, MobileCtaBar, hero/, sections/, BeforeAfter, SectionMotion
src/config/site.ts     business facts (phone, email, hours, URLs) — [OWNER] placeholders
src/config/pricing.ts  every price (null = [OWNER]); UI never hardcodes a number
src/content/home.ts    copy: services (plain name + real term), steps, cities, FAQs
src/lib/               analytics track(), motion loader (GSAP+Lenis on one ticker), head env script
src/generated/media.ts written by the media pipeline (frame count, paths, inline blur placeholders)
```

## How the hero works

- Inline head script sets `html.scrub` before first paint unless `prefers-reduced-motion`, ≤2 CPU cores,
  ≤2 GB device memory or Save-Data. That decides the track height (350svh vs 100svh) with no layout shift.
- Frame 0 is a real `<img>` (AVIF/WebP, `fetchpriority="high"`). Reduced motion gets the last (beaded) frame via `<picture media>`.
- First 10 frames preload 2.5 s after `load` (or on first scroll). GSAP/ScrollTrigger/Lenis and the remaining
  frames load on the first scroll/touch/key, nearest-to-current first, then coarse-to-fine.
- Copy is server-rendered HTML; scroll reveals beats at 30% and 60%.

## Phase 6: SEO + local

- Content: `src/content/seo/services/*.ts` (9), `src/content/seo/cities/*.ts` (14, plus `extra.ts`), `content/blog/*.mdx` (10). Templates: `src/components/seo/`. Helpers: `src/lib/seo/` (schema, metadata, blog loader, og, travel note). Redirect map: `src/config/redirects.ts`.
- Routes: `/services` hub + `/services/<slug>`, `/areas` hub + `/areas/<city>`, `/blog`, `/blog/<slug>`, `/blog/tag/<tag>`, `/blog/rss.xml`, `sitemap.xml`, `robots.txt`.
- To add a post: drop `content/blog/<slug>.mdx` with `title, description (<=155), date, tags, services, cities` frontmatter. `<FromPrice service="pdr" />` and `<Callout>` are available in MDX.
- Build in a separate folder while other work runs: `NEXT_DIST_DIR=.next-p6 npm run build`.

## Analytics hooks (Phase 6)

`track(event, props)` returns an `event_id` and fans out to GA4, Meta Pixel, Google Ads and Vercel Analytics, each env-gated and consent-gated (`src/lib/analytics-consent.ts`, banner in `components/seo/ConsentBanner.tsx`). Env: `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_GADS_ID` + labels. Server side: `sendCapiEvent` in `src/lib/analytics/capi.ts`. `getAttribution()` in `src/lib/attribution.ts` returns first/last touch.

## Analytics hooks (Phase 1 note, superseded)

`track(event, props)` in `src/lib/analytics.ts` pushes to `window.dataLayer`. Wired now: `call_click`,
`text_click`, `quote_requested`, `booking_started`, `cta_click`. Phase 6 connects GA4 / Meta / Google Ads.

## Phase 2: booking engine

`/book` is the 8-step flow (services, vehicle, photos, ZIP and travel fee, real availability, contact, deposit, confirmation).
`/booking/[token]` is the signed-link reschedule/cancel page. Pure logic lives in `src/lib/{pricing,geo,availability,booking}`,
the shared data layer in `src/lib/db` (typed `repo()`), automations in `src/lib/notify`, photo quote in `src/lib/quote`.

```bash
npm run test         # vitest: pricing, geo, tz/DST, availability, state machine, policy, quote, notify, full booking flow
node scripts/book-flow.mjs http://localhost:3000   # Playwright walk of the whole flow on a phone viewport + axe (mock mode)
```

### Mock mode (no keys)
| Service | Without keys | With keys |
|---|---|---|
| Supabase | in-memory seeded store (`MOCK_DB_FILE` persists to a file) | Postgres via `supabase/migrations/0001_init.sql`, RLS on, service-role client server-side |
| Stripe | fake `pi_mock_*` intent, "DEMO MODE" confirm button | Payment Element, webhook-verified |
| Twilio / Resend | logged (masked) + in-memory outbox | real sends |
| Anthropic | deterministic rule-based quote labelled DEMO | `claude-sonnet-5-5` vision, structured JSON, clamped |
| Google Calendar | no-op | write-only sync per tech calendar |

### Env keys by service
| Service | Keys |
|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PHOTOS_BUCKET` (private bucket) |
| Stripe | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` (webhook URL `/api/stripe/webhook`, event `payment_intent.succeeded`) |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID` |
| Resend | `RESEND_API_KEY`, `EMAIL_FROM` |
| Anthropic | `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL` |
| Google Calendar | `GOOGLE_CALENDAR_CLIENT_EMAIL`, `GOOGLE_CALENDAR_PRIVATE_KEY`, `GOOGLE_CALENDAR_IDS` |
| App | `BOOKING_TOKEN_SECRET` (required with Supabase), `CRON_SECRET` (required in production), `BASE_ZIP`, optional `UPSTASH_REDIS_REST_URL/TOKEN` |

### How it fits together
- Prices, durations, deposit, travel fees, policy windows and SMS consent wording are config: `src/config/pricing.ts`, `src/config/booking.ts`.
- API: `/api/availability`, `/api/quote`, `/api/photos`, `/api/booking` (create, `Idempotency-Key` required), `/api/booking/[token]` (view, reschedule, cancel, pay, release, capi),
  `/api/stripe/webhook`, `/api/geo/zip`, `/api/lead`, `/api/cron/dispatch`. All validated with zod, rate limited, no PII in logs.
- Cron: `vercel.json` hits `/api/cron/dispatch` every 5 minutes (needs `CRON_SECRET`). It expires unpaid holds and sends due messages
  (confirmation, 24h and 2h reminders, on-the-way, invoice + review request 2h after completion, 6-month rebook).
- Phase 3 hooks: `sendOnTheWay()` and `scheduleAfterCompletion()` from `src/lib/notify`, `transition()` from `src/lib/booking/state`, `repo()` from `src/lib/db`.
- Database: run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql` (services, two placeholder techs, hours, a demo dealer).

## Phase 4: 916 Concierge (AI booking assistant)
Site chat widget, SMS (Twilio) and missed-call text-back, one agent behind all of them. Runs with **zero keys** (deterministic mock policy that still
goes through the real tool executor and real guardrails); with `ANTHROPIC_API_KEY` it uses `claude-sonnet-5-5` (tool use, prompt caching, usage accounting).
Threat model and every control: `src/lib/concierge/THREAT_MODEL.md`. Decisions: `DECISIONS.md` P4-001..P4-020.

### Pieces
| Path | What |
|---|---|
| `src/lib/concierge/agent.ts` | channel-agnostic loop: gates -> model tool loop (max 8 iterations, 40 s, per-conversation USD/token cap with hand-off) -> output filter -> persist |
| `tools.ts` | the 11 tools (`get_services`, `check_service_area`, `get_quote_range`, `check_availability`, `create_booking`, `send_deposit_link`, `reschedule_booking`, `cancel_booking`, `lookup_booking`, `create_lead`, `escalate_to_human`), zod-validated, authorization + provenance enforced server-side. Reuses `lib/{booking,availability,quote,pricing,geo}`; nothing re-implemented |
| `prompt.ts`, `facts.ts` | persona + policy (static, cache-stable), objection playbook, customer-facing wording read from config |
| `guardrails.ts` | sanitiser/fence, gibberish/abuse/legal/safety triggers, rate limits, output filter, PII-minimised logging helpers |
| `memory.ts`, `state.ts` | shared memory per verified phone (Supabase `customer_memory`), conversation state, CRM lead per conversation, needs-human inbox queries |
| `channels.ts`, `adapters/meta.ts` | channel adapter interface (web, sms) + documented stub for IG/FB DMs |
| `twilio.ts`, `missedcall.ts`, `optout.ts`, `verify.ts` | signature validation, TwiML, MMS fetch; text-back; STOP/START/HELP; web phone verification |
| `anthropic-model.ts`, `mock-model.ts`, `models.ts` | live client, offline policy (with adversarial modes for tests), cost math |
| `src/components/chat/*` | widget: `ConciergeLauncher` (the only code shipped on every page) + lazy `ChatPanel` |
| API | `POST /api/chat` (SSE), `/api/sms`, `/api/voice/{incoming,missed}`, `/api/concierge/{verify,history,cron}` |
| Schema | `supabase/migrations/0003_concierge.sql` (run after 0001; independent of 0002/0004) |

### Env (all optional; empty = mock)
`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`), `CONCIERGE_MAX_COST_USD` (default 0.50 per conversation), `OWNER_ALERT_PHONES` (E.164, comma separated: escalation texts and call forwarding),
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`, `NEXT_PUBLIC_SITE_URL` (must be the public origin Twilio calls) or `TWILIO_WEBHOOK_BASE_URL`,
`CRON_SECRET`, `BOOKING_TOKEN_SECRET` (also signs chat session tokens), optional `UPSTASH_REDIS_REST_URL/TOKEN`, `SMS_REPLY_MODE` (`async`|`twiml`), `CONCIERGE_SMS_KEYWORD_REPLIES=1`.

### Twilio console wiring (exact)
**Inbound SMS/MMS**
1. Console > Phone Numbers > Manage > Active numbers > your number > *Messaging configuration* > **A message comes in** = *Webhook*, `https://YOUR-DOMAIN/api/sms`, **HTTP POST**.
   If the number sits in a Messaging Service, set it there instead: Messaging > Services > your service > Integration > *Send a webhook*, Request URL `https://YOUR-DOMAIN/api/sms` (the service setting overrides the number).
2. Set `NEXT_PUBLIC_SITE_URL=https://YOUR-DOMAIN` (or `TWILIO_WEBHOOK_BASE_URL`). The signature check hashes the exact URL Twilio called; a mismatch means every message is rejected with 403.
3. Leave Twilio's default opt-out handling on (STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT / START, UNSTOP / HELP). Our webhook still records the opt-out on `customers.sms_opt_out_at` and stays silent for that number; it does **not** send a second reply when Twilio is live. Put our HELP wording in Twilio's opt-out settings (`HELP_REPLY` in `facts.ts`). If you turn Twilio's keyword replies off, set `CONCIERGE_SMS_KEYWORD_REPLIES=1`.
4. Replies go out through `lib/sms` after the webhook returns an empty TwiML (a slow model never hits Twilio's 15 s limit). Without Twilio keys the reply comes back inside the TwiML (handy with a tunnel).
5. A2P 10DLC brand + campaign registration is required for US delivery (see Phase 2 list). The bot's first message to a number always carries the STOP line.

**Missed calls** (pick one)
- **A. Twilio number is the business line.** *Voice configuration* > **A call comes in** = Webhook, `https://YOUR-DOMAIN/api/voice/incoming`, POST. It rings the numbers in `OWNER_ALERT_PHONES` for 20 s (`<Dial action=/api/voice/missed>`). If nobody answers (`no-answer`, `busy`, `failed`, `canceled`) Twilio calls `/api/voice/missed`, which texts the caller within seconds and plays a short goodbye.
- **B. Your existing number forwards only unanswered calls to Twilio** (carrier conditional forwarding). Set the Twilio number's **A call comes in** webhook to `https://YOUR-DOMAIN/api/voice/missed?mode=forwarded`, POST. Every call that reaches it counts as missed.

Rules enforced in code: one text-back per number per 6 h, none while a chat is active, none to opted-out numbers, owners or blocked caller ids, none between 9pm and 8am Pacific (queued; `/api/concierge/cron` sends it at 8am, scheduled in `vercel.json` every 10 min with `CRON_SECRET`; Hobby plans only run daily crons).
Both voice routes validate `X-Twilio-Signature` the same way. With Supabase live and Twilio unconfigured they return 503.

### Web chat details
- Floating button on every public page (hidden under `/admin`), full-height sheet on phones, 400 px card on desktop. The chat panel is one lazy chunk that downloads only on pointer/focus/touch/click of the button: nothing loads on idle, so Lighthouse is unaffected (numbers in the P4 handoff).
- Streams over SSE from `/api/chat`: tool-progress `status` events, then the reply in paced chunks. The reply is streamed **after** the output filter approves it (a filter cannot judge half a sentence), so this is not raw token streaming.
- Photos: client-side resize, `POST /api/photos`, then attached to the message by path; the quote tool accepts only photos attached in that conversation.
- Phone verification (needed to book or to look up / change / cancel): inline form, SMS code (live) or the fixed demo code `424242` (**offline demo only; never when Supabase is live**).
- Cards (estimate, held time + "Pay $50 deposit" button, bookings list, verify form, hand-off) come from tool results, never from model text.
- Conversation id + signed session token live in `localStorage` (`d916_concierge_v1`); reload restores the transcript via `/api/concierge/history`.

### Hand-off contract for the admin inbox (Phase 3)
`conversations.status = 'escalated'` and `needs_human = true`, with `escalation_reason`, `escalated_at`, `lead_id`, `customer_id`, `summary`. Read with `listNeedsHuman()`, `conversationTranscript(id)`; give the bot back with `resumeConversation(id)` (all in `src/lib/concierge/state.ts`; or query `repo().conversations` directly). Leads from the bot have `source` `chat` or `sms`; the original attribution is in `utm_*` and `first_touch.derived_source`. Cost per conversation is `conversations.cost_usd`; per-turn usage events are `events.type = 'concierge.usage'` (no content).

### Tests
`npx vitest run tests/bot tests/unit/concierge` (offline, mock policy). `tests/bot/scenarios.test.ts`: 15 scenarios, each with its expected behaviours written down. `tests/bot/adversarial.test.ts`: 13 cases where the mock model misbehaves and the server blocks it.
Live model: `BOT_LIVE=1 ANTHROPIC_API_KEY=... npx vitest run tests/bot/scenarios.test.ts` (tolerant assertions; costs a few cents). Browser flow: `node scripts/concierge-flow.mjs http://localhost:3000` (Playwright, 390x844, axe, screenshots in `.shots/concierge/`).
