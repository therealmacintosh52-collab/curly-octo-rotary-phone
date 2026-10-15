# T-916-P4 handoff: Phase 4 "916 Concierge" AI booking assistant (agent -> orchestrator)

Branch `claude/916-dent-detail-build`. Not pushed. No accounts created, nothing deployed, no spend, nobody contacted, no real SMS or API call made.
Commits (mine only): `9416354` core, `ccb6834` tests, `3898386` widget, `f96caaf` docs/hardening (+ this file).

## Built
- **Agent** `916-dent-detail/src/lib/concierge/`: one channel-agnostic loop (`agent.ts`): idempotency -> SMS STOP/START/HELP in code -> opt-out gate -> lockout -> rate limits (IP / conversation / phone) -> hygiene (length, gibberish, abuse, legal/safety triggers) -> model tool loop (max 8 iterations, 40 s, per-conversation USD + token cap with graceful hand-off + owner text) -> post-turn escalation backstop -> output filter -> persist, usage events, shared memory.
- **11 tools exactly** (`tools.ts`), zod-strict, all rules enforced server-side: slot provenance (ids only from `check_availability` in this conversation, 2 h TTL, bound to purpose), photo provenance (dent quote/booking need 2 photos attached in this chat), verified phone or signed manage-token for lookup/reschedule/cancel/deposit link, two-step cancel across customer turns, SMS consent never inferred. Reuses `lib/{booking,availability,quote,pricing,geo}`; nothing re-implemented.
- **Persona/policy** (`prompt.ts`, `facts.ts`): static cache-stable prompt (canary, no per-request text), 1-3 sentence voice, plain service names, objection playbook (body shop, paint, water/power, haggling), hand-off list, AI disclosure. Facts come from config / published content.
- **Guardrails** (`guardrails.ts`, `THREAT_MODEL.md`): sanitiser + fencing (angle brackets broken, role-spoof defanged, invisible chars stripped), output filter (prices only from config/tool, estimate label, discount/guarantee/credential/free/human claims, unbacked booked/cancelled/paid claims, prompt/secret/tool leaks, foreign links, foreign phone/email), lockout, PII-minimised logging, safe image handling.
- **Channels**: web widget (`src/components/chat/*`, SSE from `/api/chat`, photo upload, chips, verify form, estimate / held-time-with-pay-button cards, persisted conversation, reduced-motion aware, lazy chunk), SMS `/api/sms` (signature validation, async reply, dedupe by MessageSid, MMS from api.twilio.com only), missed-call `/api/voice/missed` + optional `/api/voice/incoming` (60 s, dedupe 6 h, quiet hours queue + `/api/concierge/cron`, opt-out aware). Adapter interface + IG/FB stub documented in `channels.ts` / `adapters/meta.ts`. Twilio console wiring is in README ("Phase 4").
- **Memory/CRM**: `customer_memory` keyed by verified phone (same row for web + SMS), one lead per conversation (`source` chat/sms, attribution kept), needs-human inbox contract (`listNeedsHuman`, `conversationTranscript`, `resumeConversation`).
- **Schema** `supabase/migrations/0003_concierge.sql` (0001 untouched). Shared-file touches (additive): `src/lib/db/types.ts` (optional conversation fields, `customer_memory`, `LeadSource` + `chat`/`sms`), `src/app/layout.tsx` (one line: `<ConciergeLauncher />`), `vitest.config.ts` (include `tests/bot`), `vercel.json` (cron `/api/concierge/cron` every 10 min), README/TODO/DECISIONS (P4-001..020)/.env.example.

## Evidence (final tree)
```
$ npx tsc --noEmit                      -> (no output, exit 0)
$ npm run lint                          -> 0 errors, 3 pre-existing warnings (JobPanel <img>, others' files)
$ npx vitest run                        -> Test Files 37 passed (37) / Tests 459 passed (459)
$ npx vitest run tests/bot tests/unit/concierge -> Test Files 14 passed (14) / Tests 170 passed (170)
$ NEXT_DIST_DIR=.next-p4c npm run build -> check-similarity: OK / ✓ Compiled successfully / exit=0
   routes: /api/chat /api/sms /api/voice/incoming /api/voice/missed /api/concierge/{cron,history,verify}
$ node scripts/concierge-flow.mjs http://localhost:3140   (390x844, mock mode)  -> 29 "ok:" checks, "All checks passed"
```
- Scenarios (`tests/bot/scenarios.test.ts`): all 15 requested, each with its expected behaviours written in the file; adversarial (`tests/bot/adversarial.test.ts`): 13 cases (unoffered slot, other customer's phone, prompt leak, $20 / 20% off, obeying a vision-note injection, same-turn cancel, cancelling someone else's booking, fake photo ids, claims to be human, PII echo, infinite tool loop, hang, forgotten escalation, unverified booking). 
- Mutation spot-check: disabling slot provenance, phone match, two-step cancel, price filter, authz compare (one at a time) each turned tests red; the photo-minimum check survived because a second check also refuses (redundant guard, by design).
- Playwright (viewed screenshots in `.shots/concierge/`, git-ignored): found and fixed: header title wrapping, stale tall textarea after send, raw signed URL overflowing the bubble (web now shows the pay button instead), slot chips one-per-row, "Tap Verify phone" wording that pointed at a non-existent button. axe (wcag2a/2aa/21aa): 0 serious/critical on dialog, verify form, booking card.
- curl smoke on the built server: `/api/sms` replies TwiML, STOP confirms, text after STOP gets empty TwiML, `/api/voice/missed` replies, `/api/chat` streams SSE.
- **Lighthouse mobile, home `/`** (`scripts/lh.mjs`, 3+3 runs each, machine load average 4-7 from other agents, so noisy): without launcher perf 96, 85, 82, 62, 78, 91 (median 83.5); with launcher 93, 97, 73, 81, 80, 81 (median 81). a11y/best-practices/seo 100 in every run, CLS 0. **I could not demonstrate a median >= 90 on this loaded machine, with or without the widget**; best runs were 96 and 97, and P6 already noted dips under CPU load. Not a measured regression: the initial JS payload is the same before interaction (11 scripts, 556,801 B base vs 556,339 B with launcher; chat panel chunk not requested until pointer/focus/touch/click). Re-measure on the real host.

## NOT verified (read this)
1. **Live model behaviour.** Zero live Anthropic calls were made (no key). All 15 scenarios and 13 adversarial cases ran against the offline rule-based mock policy through the real executor and filters. That proves plumbing and server-side enforcement; it does NOT show the live model asks for photos, handles objections in good voice, picks the right tools, or stays under 3 sentences. The `AnthropicModel` client is only tested against a stubbed SDK (request shape, cache_control on the system block, usage mapping, unchanged replay of a tool turn). `BOT_LIVE=1 ANTHROPIC_API_KEY=... npx vitest run tests/bot/scenarios.test.ts` reruns the scenarios with tolerant assertions; I could not run it.
2. Prompt caching: one breakpoint at the end of the system prompt is in place and the prompt is byte-stable, but `cache_read_input_tokens` has never been observed. The prefix may also be under the model's minimum cacheable length (tools + system measure about 3,400 tokens by a chars/4 estimate); check usage on the first live traffic.
3. Twilio: signature code is cross-checked against the official package's `getExpectedTwilioSignature` and routes are tested with a stubbed `fetch`, but nothing was tested against Twilio. Console wiring is documented, not exercised. A2P 10DLC not done.
4. `0003_concierge.sql` and the Supabase path of every new repo call were never run against Postgres (mock store only). In particular the widened `leads_source_check` relies on 0001's auto-generated constraint name, and the unique index `events_concierge_sms_in_once` is what dedupes webhook retries on Supabase.
5. Real phone verification by SMS code, real MMS photo download, real missed-call webhooks, and the cron on Vercel.
6. Real devices (iOS keyboard / dvh behaviour, camera capture). Desktop was only screenshot-checked once. No human screen-reader pass.
7. Cross-instance behaviour: per-conversation lock, in-memory rate limiter, IP abuse ledger are per process (Upstash covers only the limiter). Two simultaneous texts from one phone on separate serverless instances can race on `conversations.state`.

## Risks / decisions for you
1. A live model can still be unhelpful or odd inside what the filter allows (it blocks classes of claims, not all nonsense). Read real transcripts before any launch; extend `OFF_BRAND` / prompt from them.
2. Web booking needs SMS phone verification (cost + friction; code costs a text). Alternative in TODO: web = quote only, book by SMS.
3. SMS reminder consent is never inferred from chat, so bot-booked customers get email confirmations and no SMS reminders unless you add an explicit consent step (counsel-reviewed wording).
4. `LeadSource` now includes `chat` and `sms`: Phase 3 reports/labels that enumerate sources must add them (Phase 3 should also surface the needs-human inbox via the exported queries).
5. Owner alert texts include the customer's phone and a 240-character excerpt. Confirm acceptable.
6. Transcripts in `messages` are customer PII with no retention job yet.
7. The bot refuses to state hours (`site.hours` unset) and offers the business phone only when `site.phone.placeholder` is false; facts wording is listed in TODO for owner confirmation.
8. Process note: while cleaning up my own test servers I ran a broad `pkill`-style match once and killed another agent's Next dev server (port 3106); it needs a restart if still wanted. `P3`'s commit `91bb529` also swept my uncommitted `layout.tsx` launcher line into its commit before my widget files were committed; HEAD between that commit and `3898386` would not compile. Fixed at `3898386`.
9. Server-side `fallbacks` for model refusals not enabled (refusal -> human hand-off); IG/FB DMs are a documented stub only.
