# Playbook — build a local-business website from the blueprint

Status: proven (two sites shipped: `sites/cali-tints/`, `sites/phils-auto-fleet-repair/`). Owner of this file: Orchestrator.

## When
A prospect has agreed in writing to a site and the owner has logged a deposit or a signed go-ahead (`A-###`). Spec builds for a pitch are allowed only as a preview with a standing permission (SP-2).

## Inputs
1. `blueprint/intake.md` filled for the client. Blank beats guessed; blanks render as "ask the owner".
2. Red-team PASS for the engagement (price, scope, legal).

## Steps (builder)
1. Follow `blueprint/new-site-prompt.md` verbatim, steps 1–9. Stack is fixed by `blueprint/MASTER-BLUEPRINT.md` §2; do not re-decide.
2. `cp -r sites/cali-tints sites/<slug>`; clean per the prompt.
3. Data file first (`src/data/site.json`), then tokens, then hero (placeholder poster if no video), then copy, then SEO/AI-search, then OG images.
4. Gates (all must pass; paste outputs into the handoff): `npm run build` · `node scripts/audit.mjs` (exit 0) · `node scripts/lh.mjs` (mobile ≥90 perf, 100/100/100, CLS 0) · placeholder grep (`REPLACE-ME`, `example.com`, `TODO`).
5. Preview: `node scripts/preview-relative.mjs` → GitHub Pages workflow (`.github/workflows/deploy-phils-site.yml`) if SP-2 is active; else hand qa the `dist/` path.
6. Handoff to qa with commit, rollback hash, "owner still has to supply" list.

## Steps (qa)
Re-run every gate. Verify every factual claim in copy against the intake. Phone number identical everywhere. One H1 per page. JSON-LD valid. Checklist: `library/checklists/local-site.md` (create on first run).

## Steps (growth)
Launch kit per `blueprint/MASTER-BLUEPRINT.md` marketing section: review-request templates, Google Business Profile checklist, IndexNow push (owner taps), 301 map if replacing an old site.

## Owner phone steps
Approve intake · pay/collect deposit · claim domain + DNS (or client does) · connect Netlify/Vercel (free tier) · verify Google Business Profile · submit IndexNow.

## Known costs
Domain ~$10–15/yr (client pays) · hosting $0 on Netlify/Vercel free tier · FormSubmit $0 · Stripe deposit 2.9%+30¢.

## Metrics to track
Intake → preview hours · preview → deposit days · build tokens · qa rejections per site.
