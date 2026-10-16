# T-916-P9 handoff: open-item fix pass (agent -> orchestrator)

Branch `claude/916-dent-detail-build`. Not pushed by this agent. Nothing deployed, no account, no spend, nobody contacted. Details: `916-dent-detail/DECISIONS.md` P9-001..014, `SECURITY.md` (S-13..S-18), `LAUNCH.md` C, evidence images `916-dent-detail/docs/p9/`.

## Fixed
1. **Hero video**: white ring/chip = source frames 21-36 (peak 28-31, web frames 011-017; the "ghost ring" is the same object). Removed in `scripts/media.mjs` via `scripts/lib-hero-repair.mjs` (mask + diffusion fill, ramped 21-26). Region frame-to-frame diff before `4.6 5.6 6.1 7.8 10.4 15.5 20.9 17.6 11.1 ...`, after `4.6 5.6 5.8 5.7 5.5 4.7 4.3 5.2 5.7 ...` (spike gone). Viewed: acceptable (faint smudge at 3x zoom on 027-029). Desktop 2x Lanczos+unsharp NOT adopted: PSNR 27.63 vs bilinear 27.64 dB (sharpening lower), +10 MB. Colour kept blue (gold grade = brown car).
2. **Flaky approval** (P9-003): button clickable before hydration, and the old step matched the account badge "Approved". Disabled-until-hydrated; spec fails on old code, 40/40 on prod build.
3. **Flat D-mark** (P9-004): all favicons/app icons/maskable/admin icons + favicon.svg from `scripts/lib-dmark.mjs`; header/OG stay 3D. Viewed at 1x and enlarged.
4. **Security** (P9-005): CSP enforced (script-src keeps 'unsafe-inline': nonce would kill static rendering), HSTS, token-page headers, TRUST_PROXY + rate-limit abstraction w/ Upstash adapter, body caps, staff sessions 3 days, add-on compare-and-set, npm audit 22 -> 14 (prod 0), unused `resend` removed.
5. **check:owner** (P9-006/012): 172 -> 73 real lines in 8 categories; 103 false positives listed with reasons. Leave-behind tested with a dummy URL via `--out` (QR decoded OK), committed PDF built without it, output now byte-stable.

## Verification (quoted)
```
npm run verify:  typecheck pass, lint pass, unit 644 passed (59 files), build pass, seo pass, owner report (73), e2e 138 passed / 2 skipped, axe pass   -> verify OK
npm run lhci (3 runs, median): / 2271  service 2124  folsom 2121  book 2114  dealers 2422  blog 2557 (FAIL by 57 ms)   perf 97-99, a11y/bp/seo 100, CLS 0, TBT 29-45
5-run medians before -> after: home 2270->2415, service 2536->2674, folsom 2017->2537, dealers 2439->2143, blog 2271->2295, book 1970->2677
```
## Not fixed, and why
- **LCP <= 2500 on all six: NOT reliably met.** Root cause found: identical request set every run, but Lighthouse counts React's hydration task only when it starts before the observed paint (96-119 ms vs 92-127 ms), a coin flip worth ~0.5 s (runs cluster at 2.0-2.1 s or 2.5-2.7 s). Three variants A/B tested (24 runs each): none beat noise; heading-font variant cost +150 ms FCP and CLS 0.03; none shipped. Real LCP ~0.2 s, simulated FCP 0.91 s. Re-measure on the real host.
- Account/live only: Supabase Auth settings and MFA (O-04/O-05), Upstash for cross-instance limits (O-02), RLS/Storage on real Supabase (O-07), live integrations (O-08), statement-building atomicity needs a live Postgres RPC (O-09). 14 dev-tool npm advisories have no patched release anywhere (O-03).
- Owner/legal: all 73 check:owner lines, counsel review of /privacy, /terms, SMS wording.
Note: harness made WIP snapshot commits during the run; my commits are P9-001, -004, -003, -005, -006, -007 plus two small fixes.
