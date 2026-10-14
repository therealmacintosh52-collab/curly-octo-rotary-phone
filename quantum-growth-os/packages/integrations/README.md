# packages/integrations

One interface per third party (payments via `PaymentProvider`, Twilio, Retell, BrightLocal, Local Falcon, Anthropic, Google, Meta, Cloudflare,
HubSpot behind a CRM interface, `HostingProvider`, email). Each has a `live` adapter and a `manual` adapter that produces the
content plus a step checklist for the operator. The `*_MODE` env flag picks the adapter; `manual` is the default.
Nothing here yet.

Payments: `PaymentProvider` has a `square` adapter (live) and a `manual` adapter. Zelle has no API, so it is recorded through the manual
adapter (operator marks the payment received). See decision D-001 in `../../CLAUDE.md`.
