# T-916-P1 — builder → orchestrator

**Status:** DELIVERED (one target missed: mobile LCP, see Evidence 6)
**Task:** 916 Dent & Detail Phase 1: media pipeline, Next.js scaffold, scroll-scrub hero, marketing site, quality pass, docs (D-029, SPEC.md Phase 1)
**Attempt:** 1 of 3
**Completed (UTC):** 2026-10-15T11:55Z
**Cost:** ~300k in / ~65k out, ~60 min wall · model opus
**Tools used:** Read, Write, Edit, Bash (ffmpeg/ffprobe, node, npm, sharp, ImageMagick, Playwright 1.56.1 + pre-installed Chromium, Lighthouse 13.5.0, @axe-core/playwright, pip fonttools in a scratch venv, git). No MCP tools. No network calls beyond npm/pip package installs.
**Branch:** `claude/916-dent-detail-build` · commits c69c94b, 1befa68, 189f7bd, ca81299, 86566e0 · **Rollback:** `git reset --hard 713d402` (HEAD before my first commit). Not pushed, not deployed, nothing published.

## What was done
1. `scripts/media.mjs` (re-runnable) generates everything in `public/` from `brand/`: luminance-keyed logo with colour un-mix, D-mark + clean mark, favicons 16/32/48 ico/180/512/maskable, OG 1200x630, mp4+webm (video only), 121 WebP frames (m 720x1280, d 720x1000 crop), AVIF/WebP poster (frame 0) + static (last frame), beading 2 sizes + backdrop, `src/generated/media.ts`.
2. Next.js 16.4.1 App Router, TS strict, Tailwind v4 `@theme` tokens, Michroma + Inter self-hosted (`next/font/local`, subset), GSAP+ScrollTrigger+Lenis on one ticker.
3. Hero: sticky 350svh track, canvas scrub, SSR h1 with 3 beats, LCP poster `<img fetchpriority=high>`, desktop 55% rounded panel over blurred beading, mobile full-bleed + sticky Call/Text/Get price bar, static mode for reduced-motion/low-end/Save-Data.
4. Home sections (one GSAP motion each), routes /services /dealers /pricing /reviews /book, branded 404, JSON-LD (AutoRepair/LocalBusiness, no address, no aggregateRating; FAQPage).
5. QA scripts: `scripts/lh.mjs`, `scripts/axe.mjs`, `scripts/shots.mjs`, `scripts/check-owner.mjs` (launch gate).
6. README.md, TODO.md, .env.example (all phases, empty values), DECISIONS P-005..P-021.

## Outputs
- `916-dent-detail/` (app root): `src/`, `public/`, `scripts/`, `README.md`, `TODO.md`, `DECISIONS.md`, `.env.example`

## Evidence
| # | Claim | Tag | Source (command / file · date · quoted value) |
|---|---|---|---|
| 1 | Next latest stable is 16.4.1 | VERIFIED | `npm view next version` · 2026-10-15 · "16.4.1" |
| 2 | Gates pass | VERIFIED | `npm run typecheck` "exit=0"; `npm run lint` "exit=0"; `npm run build` "exit=0", "✓ Generating static pages using 3 workers (9/9)" · 2026-10-15 |
| 3 | No serious/critical axe violations on 7 routes × (mobile, desktop, mobile-reduced) | VERIFIED | `node scripts/axe.mjs` · 2026-10-15 · "serious/critical violations: 0", "axe exit=0" (first run found `scrollable-region-focusable` on /pricing; fixed) |
| 4 | Lighthouse a11y/BP/SEO = 100/100/100 on every run | VERIFIED | `node scripts/lh.mjs` JSON in session scratchpad `lh5/` · 2026-10-15 |
| 5 | Mobile Performance ≥90 on home | VERIFIED | `lh.mjs --runs=5`, mobile preset · 2026-10-15 · perf "94, 95, 98, 95, 95" · TBT "180, 150, 100, 150, 130 ms" · CLS "0" all runs · FCP "0.9 s" |
| 6 | **Mobile LCP <2.5 s: NOT MET on home** | VERIFIED | same 5 runs · LCP "2.7 s, 2.6 s, 2.1 s, 2.6 s, 2.7 s" (median 2.6 s). Observed (unthrottled trace) LCP = FCP = 159-234 ms, element `span.beat-1` "Dents gone." |
| 7 | Inner routes, mobile, 1 run each | VERIFIED | services "97 / LCP 2.3 s", dealers "99 / 1.7 s", pricing "95 / 2.4 s", reviews "97 / 2.0 s", book "98 / 2.2 s" · CLS "0" all |
| 8 | Desktop home | VERIFIED | `lh.mjs --desktop` · perf "100", LCP "0.6 s", TBT "10 ms", CLS "0" |
| 9 | Media bytes | VERIFIED | `scripts/.media-report.json` + `ls` · frames m "12067.8 KB" (121 files, median 107,574 B), d "9230.0 KB"; mp4 "3,132,383", webm "2,296,934"; poster-m.avif "21,853", static-m.avif "39,026"; beading-1122.avif "119,504", -640.avif "57,066", backdrop "2,092"; og-image.jpg "43.6 KB"; favicon.ico "4,381" |
| 10 | Output video has only a video stream | VERIFIED | `ffprobe` assertion inside `media.mjs` (throws otherwise) · run exit 0 |
| 11 | Screens checked by eye: hero 0/35/70/100% + 10 sections + footer, mobile 390x844 and desktop 1440x900, normal and reduced motion; inner pages | VERIFIED | `node scripts/shots.mjs` · 2026-10-15 · "errors: none" for all 4 passes. Defects found and fixed: desktop line-3 wrap, invisible backdrop, eco graphic clipping, blur-glow banding, tiny map labels |

## Why LCP misses, and options (for orchestrator/qa)
Lantern adds every request started before observed LCP (~160 ms) into the estimate: about 246 KB across 15 requests on HTTP/1.1 localhost. Of that, framework JS is about 117 KB gz (react-dom 71 KB + Next runtime 46 KB), which I can't remove. Already cut: motion JS deferred (TBT 1,130 to about 150 ms), fonts 66 to 40 KB, poster 40 to 22 KB. Experiment: dropping Inter 600 gave LCP "2.5, 2.5, 2.6, 2.5 s", so it was reverted (costs the semibold UI type). Options: (a) accept, and re-measure on the real host (HTTP/2/CDN; UNVERIFIED that it passes); (b) switch to a single variable Inter file (needs `@fontsource-variable/inter`, a different package than SPEC names); (c) drop Inter 600. qa decides; no threshold was changed.

## Media assessment for the owner (from viewing extracted frames, not guesses)
- **Video is vertical only, 720 wide.** Desktop shows it in a 792 px-wide panel, about 1.1x upscaled (about 2.2x on retina), so it looks soft. Ask for a 1080w+ vertical master and, ideally, a 16:9 cut for desktop.
- **Colour:** the video is cool blue (blue LED, navy car); the brand is gold on black. It works as contrast, but a warmer grade or a gold accent light would tie it to the logo.
- **Dent on frame 0: clearly visible** (good LCP/story start). The dent "morphs" out over source frames ~24-44 (web frames 012-022) rather than popping. Frames 014-017 show a stray white chip at the bottom of the dent, and a ghost ring drifts across the door; at scroll speed it's mostly hidden. Paint shows AI-style circular swirl texture throughout, which is ironic for a swirl-removal business.
- **Loop/end:** the video ends fully beaded and does not loop back to frame 0 (fine for scrub). The last frame is used as the reduced-motion still.
- **Weight:** 121 frames at q80/720w = 12.1 MB mobile. Measured alternative: 540w q70 is about 5.8 MB. Recommend switching if field data shows many cellular visitors.
- **Logo:** not tightly cropped (the source has about 15% black margin; the pipeline trims it). The gold particle cloud keys out cleanly on onyx. On white it leaves a faint tan haze above the roof, and gold-on-white contrast is weak in any case. The 3D bevel turns to mush at 16/32 px: favicons use a particle-free D crop, but a flat vector D-mark would read far better.
- **Beading image:** strong and on-brand; 1122x1402 is enough for its 560 px slot. As a hero backdrop it is blurred/darkened, so resolution doesn't matter there.

## Assumptions
- Commit trailer: I used `Co-Authored-By: Claude Opus 5.5` (the model actually running) instead of the "Claude Sonnet 5.5" line in the task text; the session's attribution instruction asks for accuracy. Flagging the deviation.
- Builder agent rule "never add Tailwind" does not apply here: SPEC + D-029 require Tailwind (P-006).
- City list, prices, phone, hours: taken from SPEC or left as `[OWNER]`; nothing invented. The schematic map positions are approximate and labelled as such.

## Open risks
- INP not measured (no field data, no scripted interaction trace): UNVERIFIED. TBT 100-180 ms is the only proxy.
- Real-device scroll smoothness (iOS Safari decode of 720x1280 WebP while scrubbing): UNVERIFIED, only headless Chromium was tested.
- `public/` adds about 30 MB of binaries to git (frames + video). Fine for now; consider Git LFS before the repo grows.
- Eco, COI, same-day and hail-claim photo claims come from SPEC intent and are listed in TODO for owner confirmation.

## Owner still has to supply
Phone, email, hours, domain, Google review link, social URLs, 3 real reviews, 3 before/after photo pairs, all prices (6 services + 3 memberships + dealer sheet), tier contents, confirmation of reclaim equipment/permits, COI, same-day on-lot. Optional: 1080w+ / 16:9 video, vector D-mark. Full list: `916-dent-detail/TODO.md`. `npm run check:owner` currently reports "41 owner placeholder line(s) remain", exit 1.

## Acceptance checklist (task brief)
- [x] Media pipeline + bytes + assessment (Evidence 9-10, section above)
- [x] Next 16.4.1 + TS strict + Tailwind + GSAP/ScrollTrigger + Lenis, fonts self-hosted, tokens, skip-link, focus rings
- [x] Hero per spec incl. static mode, LCP poster, no CLS (CLS "0")
- [x] Sections + placeholder routes + 404
- [ ] Mobile LCP <2.5 s: **missed** (median 2.6 s); Perf ≥90 met; CLS <0.1 met; a11y ≥95 met; axe 0 serious met
- [x] README, TODO, DECISIONS, .env.example, .gitignore; node_modules not committed (`git ls-files | grep -c node_modules` → "0")

## Self-check
- [x] Every claim tagged; VERIFIED rows cite command/file + date + value
- [x] Only owned paths written (`916-dent-detail/` per D-029, this handoff)
- [x] No hard-gate action (no deploy, account, spend, publish, contact)
- [x] Under 120 lines · cost line filled

## QUALITY SCORE: 4/5
Everything requested is built and measured, and gates were run with numbers pasted. Minus one because mobile LCP misses by about 0.1 s median and INP/real-device behaviour are unverified. Hitting LCP on the deploy host, or the variable-font option, would make this a 5.
