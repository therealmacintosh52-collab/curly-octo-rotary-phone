# Plan — as of Sunday 2026-09-27

One plan for everything in this repository, in priority order. Written from the
live state of GitHub Actions, Vercel and the branches on 2026-09-27; every fact
below has a source, and anything unverified says so.

## 0. Where things actually stand

| Project | Where | State (verified) | Verdict |
|---|---|---|---|
| **Cali Tints app** (job log, invoicing, Clover terminal) | `apps/cali-tints` on `redesign`, `cali-tints-demo`, `claude/detailing-invoice-app-01l247` (all at `407b72a`) | Live in production on Vercel (project `cali-tints-demo`, Hobby plan, last deploy READY 2026-09-27 20:36 UTC, built from a **separate** repo `therealmacintosh52-collab/cali-tints-demo`, branch `main`). **CI in this repo is red on every push**: `pnpm typecheck` fails with 21 `Cannot find name 'PageProps' / 'LayoutProps' / 'RouteContext'` errors. | Active. Ship the CI fix, then finish the payment rollout. |
| **Cali Tints website** (marketing, Astro) | `sites/cali-tints` on the default branch `claude/affectionate-brown-h3wfam` | Built, audited, Lighthouse 96–100, hero video in. Not launched: `site.email` is still `REPLACE-ME@example.com`, so the quote form cannot send. Production is Netlify, not yet set up. | Launch-blocked on ~6 owner facts (list in §2). |
| **Phil's Auto and Fleet Repair website** | `sites/phils-auto-fleet-repair` (Python build) | Built since 2026-08-31; served at the root of the GitHub Pages preview. Netlify production and the "verify before launch" checklist in its README are open. | Second launch after Cali Tints. |
| **Blueprint** (site factory) | `blueprint/` | Recipe + intake + paste-ready prompt, reference build = Cali Tints. | Ready for the next client; needs a filled `intake.md`. |
| **Dropship OS / Trendlift** | `DROPSHIP-OS-MASTER.md`, `dropship-os/`, `stores/trendlift` | Frozen at 2026-06-11. Father's Day 2026 passed with 0 orders; 5 products still DRAFT with `price-estimate`; every remaining blocker was owner-only (supplier costs, real photos). Nothing touched in 3.5 months. | Park it formally (see §5). Do not let it absorb Q4 time by default. |
| **Repo hygiene** | whole repo | No `main` branch. Default branch is `claude/affectionate-brown-h3wfam`. 16 branches, 3 of them identical copies of the app branch. GitHub Pages workflow triggers on a hand-listed set of branches. | Fold into one `main` once the app CI is green (§6). |

The short version: the website/app business has produced two client sites and
a live SaaS-style app in six weeks; the dropship track produced zero orders in
three and a half months. Time should follow the results.

## 1. This week: Cali Tints app (highest leverage, already has a paying context)

### 1a. Make CI green (30 minutes, no owner input)

Root cause: Next 16 generates the global `PageProps`, `LayoutProps` and
`RouteContext` types into `.next/types/` at build time. `tsconfig.json`
includes `.next/types/**/*.ts`, but CI runs `tsc --noEmit` before anything has
built, and `.next/` is git-ignored, so the globals do not exist on the runner.

Fix in `apps/cali-tints/package.json`:

```json
"typecheck": "next typegen && tsc --noEmit"
```

Then re-run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` locally,
push to `redesign`, confirm run 57+ is green. Also mirror the commit into the
`cali-tints-demo` repo that Vercel actually deploys from (or, better, point
Vercel at this monorepo with Root Directory `apps/cali-tints` and retire the
mirror, so one push updates both CI and production).

### 1b. Finish the money path (owner + Claude, ~1 week)

In order, each gated on the previous:

1. **Migrations in production.** Confirm `0009_clover`, `0010`, `0011_terminal`
   are applied to the real Supabase project (`pnpm db:push` with
   `SUPABASE_DB_URL`, or paste in the SQL editor). The Terminal tab is dead
   until `terminal_sales` exists.
2. **Clover sandbox end to end.** Owner creates the sandbox API token, the
   Ecommerce private/public keys, sets `CLOVER_WEBHOOK_SECRET` and
   `CRON_SECRET` in Vercel, points the Hosted Checkout webhook at
   `/api/clover/webhook`. Test: generate invoice → pay by card link → invoice
   flips to paid; charge card in app; pay on device; refund partial.
3. **Resend domain verified** so invoice emails and receipts send from a real
   address (`EMAIL_FROM`). Without it "Submit by email" errors by design.
4. **Switch Clover to production** in Settings → Clover, repeat the four tests
   with a $1 charge and refund.
5. **Hobby plan limit.** Cron is once a day at 14:00 UTC. If matched payments
   need to land faster, either upgrade the Vercel project to Pro and raise the
   cron in `vercel.json`, or rely on the webhook + the Sync button (current
   design). Decide once the owner has used it for a week.
6. **Detailer onboarding.** Create the two real detailer accounts in Settings →
   Users, install the PWA on their phones, one supervised day of logging.

### 1c. Housekeeping on the app

- Three branches at the same SHA (`redesign`, `cali-tints-demo`,
  `claude/detailing-invoice-app-01l247`). Keep `redesign` as the working
  branch until §6, delete the other two after confirming nothing diverged.
- The `AGENTS.md` block is regenerated by `next dev`; commit it once and stop
  fighting it.
- Add the Playwright e2e (already a devDependency) to CI once the typecheck is
  green, against the `/dev/preview/*` routes so it needs no Supabase.

## 2. Next: launch the Cali Tints website (owner facts, then one afternoon)

The site is finished. It is waiting on facts only the shop can give. Ask for
all of them in one message:

| # | Needed | Why it blocks |
|---|---|---|
| 1 | **Lead email** for the quote form | `site.email` is a placeholder; FormSubmit needs a confirmed address. Hard blocker. |
| 2 | **Hours**: Google says Mon–Fri 10–6 / Sat 10–4; Yelp says Mon–Fri 10–7 / Sat 11–5 | Whichever is wrong costs walk-ins; site and listings must match. |
| 3 | **Suite F vs "# F"** in the address | NAP consistency for local SEO. |
| 4 | **Domain**: confirm `calitintsca.com`, whether `www` is canonical, registrar login | Netlify custom domain + canonical tags. |
| 5 | **Old page URLs** from Search Console (or "none") | Fills `_redirects`; otherwise existing rankings 404. |
| 6 | **Instagram URL**, a fourth verbatim review, film brands and warranty wording | Not blocking; each improves conversion and the `sameAs` graph. |
| 7 | **10 seconds of real footage** of the bay/sign | The current clip is AI-generated by the owner's choice. Real footage replaces it with `npm run video` and no code change. |

Once 1–5 arrive: set `site.json`, `npm run build && npm run og && node
scripts/audit.mjs`, create the Netlify site (base `sites/cali-tints`, build
`npm run build`, publish `dist`), add the domain, force HTTPS, submit the
sitemap in Search Console and Bing, run `node scripts/indexnow.mjs --send`,
and test the form from a phone. Re-read the Google rating the same day and
update `rating` / `review_count` / `rating_checked`.

## 3. Then: launch Phil's Auto the same way

Same pattern, older build. Open items are all in the README's "Before you
launch" list: address confirmation, warranty text, exact map coordinates,
current rating and review count, form endpoint, certifications. Then Netlify
with base `sites/phils-auto-fleet-repair`, build `python3 build.py`, publish
`public`. Ship Cali Tints first; it is newer, faster, and its owner is
already engaged through the app.

## 4. Pipeline: the next site from the blueprint

The blueprint works; Cali Tints proves it. The constraint is intake, not
build. For each new client:

1. Fill `blueprint/intake.md` (blank beats guessed; the build renders blanks
   as "ask the owner").
2. Paste `blueprint/new-site-prompt.md` with the intake into a new session.
3. Budget: one session to build and audit, one owner round-trip for facts, one
   afternoon to launch. Price accordingly; the deliverable is proven.

Pick the next niche from businesses already in the owner's network (the
dealership detailing contacts are an obvious warm list: window tint, wraps,
PPF, detailing, and the dealerships' own service departments).

## 5. Dropship OS / Trendlift: park it deliberately

Facts: last touched 2026-06-11, 0 orders, 0 suppliers on file, products
cannot activate without supplier costs and real photos, and both of those were
owner-only actions that did not happen in 15 weeks. The seasonal calendar says
Halloween prep starts 2026-10-01 and BFCM prep 2026-10-28, which is exactly
when the website work will be busiest.

Recommendation: **pause, do not delete.**

- Add a dated "Paused" banner to `DROPSHIP-OS-MASTER.md`, `HANDOFF-TO-CLAUDE-AI.md`
  and `stores/trendlift/STATUS.md` with the restart condition: the owner has
  a supplier account with US-stock quotes and real product photos in hand.
- Set the 5 Father's Day drafts to ARCHIVED in Shopify (confirm first; it is a
  bulk change) so the store is not carrying stale drafts into Q4.
- If the owner wants a Q4 shot anyway, the only calendar-realistic play is
  BFCM/Christmas with US-stock suppliers, and the go/no-go date is
  **2026-10-28**. Miss that and the season is gone; say so up front.

Contrarian note: Shopify plan fees keep billing while the store sits idle. If
the pause is longer than one quarter, downgrade or close the store; the
campaign assets are documented well enough to rebuild in a day.

## 6. Repo hygiene (after §1a, one hour)

- Create `main` from `claude/affectionate-brown-h3wfam`, merge `redesign`
  into it (the app lives in `apps/`, the sites in `sites/`; no overlap), set
  `main` as the default branch.
- Change the Pages workflow trigger from the hand-listed branches to `main`
  only; keep `workflow_dispatch`.
- Point the Vercel project at this repo (`apps/cali-tints` root directory,
  production branch `main`) and archive the `cali-tints-demo` mirror repo.
- Delete merged/duplicate branches. Keep `claude/*` branches that hold
  unmerged experiments (`cash-home-buyer-site`, `revelation-4-video`,
  `fullscreen-video-landing`, `ai-animation-walkthrough`) only if they are
  wanted; list them in a `BRANCHES.md` or delete.
- Add a root `README.md` that maps the three products and links their READMEs
  (there is none today; `EVERYTHING.md` is dropship-only).

## 7. Sequenced calendar

| When | Do | Owner needed? |
|---|---|---|
| Mon 09-28 | §1a CI fix and push; send the owner the §2 fact list and the §1b Clover checklist in one message | No / message only |
| Tue–Wed 09-29/30 | §1b steps 1–2 (migrations, Clover sandbox) as soon as keys arrive; §5 pause banners committed | Yes (keys, Supabase) |
| Thu 10-01 | §2 website launch on Netlify if facts are in; otherwise chase | Yes (facts, DNS) |
| Fri 10-02 | §1b steps 3–4 (Resend, Clover production); §6 branch consolidation | Yes (Resend domain) |
| Week of 10-05 | §1b steps 5–6 (cron decision, detailers live); §3 Phil's launch prep | Yes |
| Week of 10-12 | §4 next-site intake; app e2e in CI | Owner supplies the next lead |
| 10-28 | Dropship go/no-go for BFCM. Default answer is no. | Decision only |

## 8. What can be done right now without the owner

1. The CI fix (§1a).
2. The dropship pause banners and archive plan (§5, archive itself needs a
   confirm).
3. Branch consolidation and a root README (§6).
4. A one-message brief to the owner containing every item in §1b and §2, so
   all the waiting happens in parallel instead of in series.

Everything else is gated on keys, facts or DNS that only the owner holds.
