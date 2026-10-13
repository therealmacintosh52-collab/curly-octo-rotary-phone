# Status by module

As of 2026-10-12. The first slice (Customers + Vehicles + Quotes + Booking + Deposits + the automation runner) is built, tested and deployed; everything after it waits for a go-ahead module by module. Every module runs with zero paid keys; Supabase Pro + Vercel Pro are the only running costs (about $45/month), Resend is on its free tier and Clover is the existing merchant.

| # | Module | Status | Migration / commit | Next step (needs a yes) |
|---|---|---|---|---|
| 1 | Core data, vehicle ID | **Done** | `0037` · `5d1095e` | Products used per vehicle; "next visit" reminders (needs Module 12's maintenance reminders) |
| 2 | Pricing, estimates | **Done** (labor / parts / fees / sublets, supplies, per-item approval) | `0038`, `0039`, `0044` | Saved canned jobs; a parts markup matrix; contract attachments |
| 3 | Booking, capacity | **Done** | `0040` · `0ceb6a0` | Multi-tech / line-item scheduling; an embeddable widget; drag-and-drop calendar grid |
| 4 | Payments, deposits | **Done** (Clover only) | `0041` · `23f7828` | First real run in the Clover sandbox from the owner's side; tipping, BNPL, memberships, gift cards (all need a decision on a processor feature) |
| 5 | Intake, photos, inspections | Partial (photos; the RO notes tab with findings, photos, clips, declined work kept) | `0030`, `0043` | Fuel / keys at check-in; SVG damage pins; DVI templates; condition sign-off |
| 6 | Work orders, board | Partial (RO numbers, statuses, the notes tab, findings → estimate → signed approval → work onto the RO) | `0040`, `0043`, `0044` | A stage board over the retail jobs; a "ready for pickup" text rule; the tech told in-app when work is approved |
| 7 | BAR compliance | Not started | — | Only if the shop does mechanical work for money; research the current BAR rules live first |
| 8 | Messaging, inbox | Partial (templates, text queue, `sms:` links) | `0042` | A per-customer thread of what went out; Twilio only if the owner pays for A2P 10DLC |
| 9 | AI sales assistant | Not started (by decision: no AI keys) | — | Zero-key scripted web chat through the same `/book` tools, then an LLM behind `AI_PROVIDER` |
| 10 | Social automation | Not started | — | Meta app review on the owner's side first |
| 11 | Owner command bar | Not started | — | After Module 9's tool layer |
| 12 | Retention, marketing | Partial (review, nudge, abandoned, reminders) | `0042` | Maintenance reminders by months / miles; declined-work drip; segments; campaign report |
| 13 | Automation engine | **Done** | `0042` | Free-form condition editor; dry run; outbound webhooks; more event kinds as modules land |
| 14 | Inventory, parts | Not started | — | Items + parts status on jobs; POs |
| 15 | Dealer and fleet | Existing (dealership invoicing, QuickBooks) | `0028`–`0032` | Dealer portal role with VIN submission into `find_slots` |
| 16 | Money, reports | Partial (owner dashboard, exports, Today tiles) | — | Expenses with receipt photo; P&L; sales tax summary; deposits report |
| 17 | Team | Not started | — | Clock-in / job clocks / commission |
| 18 | Mobile service, dispatch | Not started | — | Service address on appointments first |
| 19 | Voice AI | Not started | — | Design + cost first |
| 20 | Visual selling | Not started | — | SVG diagram shared with Module 5 |
| 21 | Platform | Not started | — | Multi-location (`company_id` is already everywhere), API keys, CSV import |
| — | Intel (BayIntel, native) | **Partial** (codes with safety flags and causes, NHTSA recalls / complaints / specs on the shop's cars, the garage; the in-app window over the separate deployment is retired) | `0045` | The shop's fix library (`0046`); the AI assistant behind a flag (`0047`) |

## Verified on every commit

`pnpm typecheck` · `pnpm lint` · `pnpm test` (77) · `supabase/tests/run.sh` (01_flows + 02_retail) · `pnpm build` · Playwright at 390 px in guest mode (`.dev/redesign-e2e.mjs`, `.dev/retail-e2e.mjs`) · GitHub Actions green · Vercel READY on the demo.

## Known gaps in the first slice (by design)

- Clover hosted checkout was never charged from the development sandbox (Clover's hosts are blocked there); the unit tests use the documented payloads. The first real run is in the Clover sandbox (GO-LIVE §7b).
- A missed Clover webhook is reconciled by hand unless `CLOVER_API_TOKEN` is set; the daily job does not call Clover yet.
- Texts are not sent by the server: they are queued for the owner's phone (one tap each). STOP handling and delivery receipts need a provider.
- A customer cannot be created offline (the picker needs signal); dealership jobs still queue offline as before.
- The calendar is a list per day / per week, not a drag-and-drop grid; one tech per appointment.
- The signature image is on the PDFs and the receipt page, not inline on the staff estimate page.
- Clips on a finding come from the phone's camera; inside the Clover app on the Flex the in-app camera takes stills only (recording there is a follow-up). Findings need signal (no offline queue yet).
