# EVIDENCE — index of every VERIFIED claim (scribe copies from handoffs; system-qc spot-audits 20% per session)

| E-### | date seen | claim | url / file | quoted snippet | source handoff | status (VERIFIED / FAILED-AUDIT / STALE) |
|---|---|---|---|---|---|---|
| E-001 | 2026-10-12 | Jun $29 billed | zendrop:get_billing_subscription_invoices | invoices[id=933872] `"status":"billed"` | ops/handoffs/T-003-auditor-to-orchestrator.md | VERIFIED |
| E-002 | 2026-10-12 | Jul $29 billed | zendrop:get_billing_subscription_invoices | invoices[id=969442] `"status":"billed"` | ops/handoffs/T-003-auditor-to-orchestrator.md | VERIFIED |
| E-003 | 2026-10-12 | Aug invoice canceled | zendrop:get_billing_subscription_invoices | invoices[id=1015584] `"status":"canceled"` | ops/handoffs/T-003-auditor-to-orchestrator.md | VERIFIED |
| E-004 | 2026-10-12 | Sep invoice canceled | zendrop:get_billing_subscription_invoices | invoices[id=1065462] `"status":"canceled"` | ops/handoffs/T-003-auditor-to-orchestrator.md | VERIFIED |
| E-005 | 2026-10-12 | Oct 9 $29 pending | zendrop:get_billing_subscription_invoices | invoices[id=1119155] `"status":"pending"`, `"amount":29` | ops/handoffs/T-003-auditor-to-orchestrator.md | VERIFIED |
| E-006 | 2026-10-12 | Billed ≠ collected | zendrop:get_billing_subscription_invoices (description) | "neither platform tells Zendrop whether the merchant was actually charged" | ops/handoffs/T-003-auditor-to-orchestrator.md | VERIFIED |
| E-007 | 2026-10-12 | Plan $29/mo, UBB-20-29 | zendrop:get_billing_plan | `"amount":29`, `"ubb_tier_summary":"Usage-based plan: up to 20 products for $29 per month."` | ops/handoffs/T-003-auditor-to-orchestrator.md | VERIFIED |
| E-008 | 2026-10-12 | Lifetime revenue $0 | zendrop:get_orders_performance | `"grossRevenue":{"value":0,"delta":"0%"}`, `"orders":{"fulfilledTotal":0,…}` | ops/handoffs/T-003-auditor-to-orchestrator.md | VERIFIED |
| E-009 | 2026-10-12 | No non-zero revenue in chart | Grep (saved get_orders_performance result; path not recorded in handoff) | Grep for non-zero revenue/value/amount/total in saved result · 0 matches | ops/handoffs/T-003-auditor-to-orchestrator.md | VERIFIED |
| E-010 | 2026-10-12 | Store lifetime orders/revenue 0 | stores/trendlift/STATUS.md:50 | none quoted in handoff; handoff notes "matches row 8" | ops/handoffs/T-003-auditor-to-orchestrator.md | VERIFIED |
