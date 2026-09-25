# Paste-ready prompt for Claude Code

Copy everything below the line, paste the filled `intake.md` where marked, and run it in a
session opened on this repository.

---

You are building a new business website from the master blueprint in `blueprint/MASTER-BLUEPRINT.md`.
The reference implementation is `sites/cali-tints/` (Astro 5, plain CSS, video hero, GSAP/Lenis,
optional desktop-only WebGL, JSON-LD, llms.txt, IndexNow, marketing kit). Follow the blueprint
exactly; do not re-decide the stack, the page architecture or the hero behaviour.

Intake for this site:

<paste the filled blueprint/intake.md here>

Do this, in order, and stop for review only after step 9:

1. `cp -r sites/cali-tints sites/<slug>`; clear `node_modules`, `dist`, `dist-preview`, `qa`, `public/assets/video`, the hero posters and the IndexNow key file.
2. Rewrite `src/data/site.json` from the intake. Verified facts only; blank where the intake is blank. Twelve services, 4–6 guides in `src/data/guides-v2.ts`, six home FAQs, four real reviews. Delete the `/es/` page unless a second language is listed.
3. Set the schema `@type` in `src/lib/seo.ts` per the blueprint's niche table; update `knowsAbout`, `slogan`, `description`, `sameAs`.
4. Brand tokens in `src/styles/legacy.css` `:root` from the logo; fonts per the blueprint's pairing table, self-hosted woff2 in `public/fonts/`, `@font-face` with `font-display: optional` and metric fallbacks in `global.css`. Replace `logo.png`, `favicon.svg`, `og-cover.png`.
5. Hero: if a video is supplied, encode it per the blueprint spec (1280×720, no audio, ≤ 3 MB, faststart), generate JPEG/WebP/AVIF posters, set `object-position` so the sign is visible on desktop and in the mobile band. If not supplied, use the storefront photo as the poster with the same markup and note "video pending" in the README. Rewrite the four story beats for this niche.
6. Rewrite all page copy per the blueprint's copy rules: headline formula, promise line, At a glance block on every service page, Short answer on every guide, numbers over adjectives, no invented claims.
7. `seo/keyword-map.md` (one family per URL), `_redirects` from the old URL list, `robots.txt` allowlist kept, `llms.txt` rewritten, new IndexNow key file, `npm run og`.
8. `npm run build`; audit: zero broken internal refs, valid JSON-LD on every page, one H1 per page, heading order, alt text. Lighthouse mobile on home, one service, one guide, contact; record in `perf/lighthouse.md`; fix until ≥ 90 / 100 / 100 / 100 and CLS 0.
9. `marketing/plan.md`, `marketing/review-request-templates.md` and the review QR for this niche; `seo/launch-checklist.md` updated; README rewritten (assumptions, run/build/deploy, where things live, swap the video). Build the sub-path preview with `node scripts/preview-relative.mjs`, publish it, screenshot desktop 1440×900 and iPhone 390×844 (hero and mobile nav open), commit and push to the designated branch. Then stop and report: preview link, what was assumed, what the owner still has to supply (video, verified rating, listings).

Rules: never invent ratings, reviews, prices, years or certifications; never add Tailwind; never
load fonts from a CDN; never block AI crawlers; keep every phone number identical everywhere;
autoplay must work without a tap on desktop and normal iPhone mode, and show the poster with a
tap cue in Low Power Mode.
