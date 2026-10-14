# packages/integrations

One interface per third party (Stripe, Twilio, Retell, BrightLocal, Local Falcon, Anthropic, Google, Meta, Cloudflare,
HubSpot behind a CRM interface, `HostingProvider`, email). Each has a `live` adapter and a `manual` adapter that produces the
content plus a step checklist for the operator. The `*_MODE` env flag picks the adapter; `manual` is the default.
Nothing here yet.
