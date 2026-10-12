# CONTEXT — who we work for and what we are optimizing

Owned by the Orchestrator. Updated whenever the owner's situation changes. Every agent reads the "Goal" and "Constraints" sections; the rest is reference.
**Last updated:** 2026-10-12 (session 2: Growth Agency MOS adopted for the Lane A stream, D-017; branch updated)

## Goal
Real revenue THIS WEEK, then reinvest profit to scale winners and fund new avenues (Revenue Sprint, `ops/PROTOCOL.md` §7). Lane A first dollar in 72 h; Lane B first sale in 7–14 days; Lane C only from profit. Long-run target >$10,000/month net. Never stop testing.

## Owner
- Operating playbook for the local-growth-agency stream: `library/playbooks/growth-agency-mos.md` via `library/playbooks/growth-agency-mos-adapter.md` (D-017, pending A-012).
- Solo founder, Sacramento / Elk Grove, California. **Phone-only, no PC.** Everything the owner does must be doable in a mobile browser or app in minutes.
- Time: **3–7 hours/week** for approvals, phone tasks, logins, customer contact.
- Budget: **under $100/month total** (AI usage + tools + any tests). Current known fixed cost: Zendrop $29/mo (see LEDGER).
- Domains the owner knows: reselling, Shopify e-commerce, investing, content.

## Hard constraints (never crossed, never "interpreted")
No scams · no spam · no fake reviews · no TOS-violating automation · legal in California · no personal-data scraping · no contacting anyone, spending, publishing, or creating accounts without a logged approval ID (`ops/DECISIONS.md`).

## Existing assets (the starting capital; reuse before building)
| Asset | Path | State 2026-10-12 | Use |
|---|---|---|---|
| Local-business website system | `blueprint/` (MASTER-BLUEPRINT, intake, new-site-prompt), `sites/cali-tints/` (reference impl: Astro 5, Lighthouse/audit gates, booking + Stripe deposit functions, SEO + AI-search kit), `sites/phils-auto-fleet-repair/` (Python static build), deploy workflow `.github/workflows/deploy-phils-site.yml` | Two complete sites (Sacramento window tint shop; Lodi auto/fleet repair). **UNKNOWN: whether either client paid, or if these were spec builds.** | Sellable service: agents build + QA + preview-deploy end-to-end without a PC |
| Trendlift dropship (Dropship OS) | `DROPSHIP-OS-MASTER.md`, `dropship-os/`, `stores/trendlift/STATUS.md` | 4 months, $0 revenue, Shopify store `ft6xi1-n1` **frozen** for arrears, Zendrop $29/mo retrying, 0 of 19 products clear the 3× floor | Liability. Default recommendation: park, cancel Zendrop. Research + failure patterns reused in `library/` |
| ClipForge | `clipforge/` | Local Python/ffmpeg app; needs a PC | Parked. Not runnable by a phone-only owner |
| Connectors in the Claude Code session | Shopify, Zendrop, Gmail, Google Drive, Lovable, Vercel, Upwork, GitHub, Claude Docs | Live. Gmail returned Forbidden on 2026-10-12 (owner may need to re-allow) | Build/deploy/draft only; owner executes anything public |

## Environment facts that shape work
- Sandbox egress is allowlisted: raw HTTP and WebFetch to commercial hosts return 403 (`dropship-os/NETWORK-INVESTIGATION.md`). **WebSearch works.** MCP connectors work. Agents cite search-result URLs; nobody "reads a page".
- Model rates used for cost tracking (API-equivalent, per MTok in/out): fable $10/$50 · opus $4/$20 · sonnet $2/$10 · haiku $0.10/$0.50. The org runs on Claude Code usage quota; dollars are a proxy.
- Repo branch for all work: `claude/growth-agency-mos-4xccqt` (session 2; session 1 was `claude/affectionate-brown-h3wfam`). Containers are ephemeral; commit and push every session.

## UNKNOWNS the owner must fill (each blocks something)
- [ ] Did Cali Tints and/or Phil's Auto pay? Amount, terms, hosting arrangement? (blocks the pitch and the pricing anchor)
- [ ] Do you have a Stripe (or Square/PayPal) account that can take a deposit today? (blocks time-to-first-dollar)
- [ ] Which phone/email should outreach drafts use as the sender identity? (blocks growth)
- [ ] Do you have an active business license / DBA in Sacramento County or Elk Grove? (blocks invoicing legality check)
- [ ] Reselling: which platforms are you active on today (eBay, FB Marketplace, OfferUp, Mercari), and what inventory/cash is on hand? (blocks the reselling lane comparison)
- [ ] Cancel Zendrop ($29/mo, no revenue)? Yes/No.
- [ ] Tax reserve % for profit allocation (confirm with a tax pro; auditor holds 25% as a placeholder until you confirm).
- [ ] Lane A inventory: what do you own and could sell this week (electronics, clothing, tools, collectibles, vehicle parts)? What services can you personally deliver (driving, assembly, cleaning, photography, reselling for others)?
- [ ] Existing businesses/customers beyond the two sites: any current clients, channels, audiences, or accounts with followers?
