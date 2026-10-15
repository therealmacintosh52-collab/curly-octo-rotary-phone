-- Optional DEMO data for a staging project only. NEVER run this on the production database: it creates a fake active dealer.
-- Idempotent. Mirrors the demo dealer in src/lib/db/seed.ts (the mock store always has it).
insert into public.dealers (id, name, contact_name, status, net_terms_days) values
  ('00000000-0000-4000-8000-0000000000d1', '[DEMO] Sample Auto Group', 'Demo Manager', 'active', 30)
on conflict (id) do nothing;
