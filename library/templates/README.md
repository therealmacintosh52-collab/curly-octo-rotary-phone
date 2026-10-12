# templates

Writer: builder. See ../README.md for what
belongs here. Delivery kits for red-team-passed
experiments, built ahead of the first "yes"
(D-020) so delivery is instant. Nothing here is
sent or published by agents.

## Kits
- `gbp-pack/` EXP-A2, $99 Google Business
  Profile copy-paste pack. Intake checklist,
  pack template, phone paste guide.
- `ai-search-check/` EXP-A3, $49 AI-search
  readiness check. 12-point checklist,
  rubric, report template, SAMPLE report.
- `review-card/` EXP-A5, $29 review-request
  card kit. HTML card + sign, renderer to
  PDF/PNG, owner phone steps.
- `check_deliverable.py` shared lint. Run it
  on every filled deliverable before the
  owner reads it. The wording checks are
  PATTERN-BASED, line by line: they catch
  known phrasings and common paraphrases, not
  every paraphrase. A clean run is not a
  compliance proof; the owner's read of every
  client file stays mandatory. The 750-char
  check fails if the DESC markers are missing
  (the AI-search report, which has no
  description, is detected by its title;
  there is no opt-out flag).

## Conventions
- Placeholders: `[[FILL: what goes here]]`
  only (HTML templates: double-brace tokens,
  filled by the script, never by hand).
- Owner-only notes: `<!-- INTERNAL ... -->`,
  stripped by the lint's `--out` copy.
- Samples: fictional, labeled SAMPLE, reserved
  `.example` domains. The lint fails on SAMPLE
  unless `--allow-sample`.
- Client data (answers, links, screenshots)
  never goes into git. Use chat or the
  gitignored `review-card/out/`.
- Every kit starts after payment shows in the
  owner's balance (red-team C5).

## Order of work for any kit
payment confirmed → intake → agents fill →
`check_deliverable.py` (or `render_card.py`)
exit 0 → owner reads → owner forwards.
