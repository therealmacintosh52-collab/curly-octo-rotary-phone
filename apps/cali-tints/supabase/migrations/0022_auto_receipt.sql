-- =============================================================================
-- 0022 — Automatic receipts (opt-in)
--   companies.auto_receipt (default off): when on, every payment that lands on
--   an invoice (Terminal, invoice page, card in the app, Clover device, pay
--   link, matched Clover payment) emails the dealership's AP contact a receipt
--   right away. Off by default; receipts are sent by hand from the Paid dialog.
-- Re-runnable.
-- =============================================================================

alter table public.companies add column if not exists auto_receipt boolean not null default false;
