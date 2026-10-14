# Quantum Growth OS

Back-office and fulfillment platform for Quantum Growth. Built phase by phase; `CLAUDE.md` is the spec, the rules and the status board.

## Resume from your phone

1. Open Claude Code on the web or in the app and start a session on this repo (branch `claude/making-money-immediately-h6i25o`).
2. Send: `Continue Quantum Growth OS: plan Phase N` (N = first unticked phase in `CLAUDE.md` Part 3).
3. The loop, every phase:
   - **Plan** (Opus, plan mode): read-only. You get a written plan for that phase only. Nothing is built.
   - **Approve**: reply yes, or ask for changes.
   - **Execute** (Sonnet): builds exactly the approved plan. If the plan turns out wrong it stops and tells you to re-plan.
   - **Close**: tests run, preview deployed, `CLAUDE.md` and the decisions log updated, your to-dos listed in `docs/MANUAL-TODOS.md`. Then it stops.
4. If a session says it is on the wrong model, run `/model opusplan`.

## Layout

| Path | What |
|---|---|
| `CLAUDE.md` | Spec, workflow rules, phase checkboxes, decisions log |
| `apps/admin` | Operator app (mobile-first) |
| `apps/portal` | Client portal and public intake funnel |
| `packages/plan-config` | Plans, prices, rules as data |
| `packages/db` | Supabase client and types |
| `packages/integrations` | Interfaces plus live and manual adapters |
| `supabase/migrations` | SQL migrations |
| `docs/MANUAL-TODOS.md` | What you need to do by hand |
| `.env.example` | Every secret and flag, with where to get it |

## Secrets

Copy `.env.example` to `.env.local` locally, and set the same keys in Vercel for deployed apps. Never commit real values. Every integration defaults to `manual` mode, so nothing needs a key to start.

## Requirements

Node 22 (`.nvmrc`) and pnpm. `pnpm install` at this folder.
