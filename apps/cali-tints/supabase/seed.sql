-- =============================================================================
-- seed.sql — reference data for a fresh install / demo.
-- Safe to run more than once (fixed ids, ON CONFLICT DO NOTHING).
--
-- Users cannot be seeded from plain SQL on Supabase (they live in auth.users
-- and need hashed passwords), so demo users + jobs come from
-- `pnpm seed:demo` (scripts/seed-demo.ts), which runs with the service role.
-- =============================================================================

insert into public.companies (id, name, email, phone, address_line1, city, state, postal_code, ein,
                              payment_terms, tax_rate, invoice_prefix, timezone)
values ('00000000-0000-4000-8000-000000000001', 'Cali Tints', 'billing@calitints.example', '(555) 010-2030',
        '1200 Auto Center Dr', 'Anaheim', 'CA', '92806', '00-0000000',
        'Net 30', 0, 'INV-', 'America/Los_Angeles')
on conflict (id) do nothing;

insert into public.dealerships (id, company_id, name, address_line1, city, state, postal_code,
                                contact_name, contact_phone, ap_contact_name, ap_emails,
                                submission_method, invoice_mode, payment_terms)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001',
   'Mercedes-Benz of Anaheim', '6500 E Santa Ana Canyon Rd', 'Anaheim', 'CA', '92807',
   'Service Manager', '(555) 200-3000', 'Accounts Payable', array['ap@mbanaheim.example'],
   'email', 'batch', 'Net 30'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001',
   'Mercedes-Benz of Irvine', '9 Auto Center Dr', 'Irvine', 'CA', '92618',
   'Fixed Ops Director', '(555) 200-4000', 'AP Desk', array['ap@mbirvine.example', 'controller@mbirvine.example'],
   'portal', 'per_job', 'Net 45')
on conflict (id) do nothing;

-- The dealer menu, grouped the way the dealership buys the work:
--   new     – PDI on arrival, delivery clean when sold
--   used    – used-car reconditioning
--   service – service-loaner details
--   addon   – touch-ups, tint removal, paint correction
-- price_min/price_max: inside the range no override reason is needed.
insert into public.services (id, company_id, name, description, category, default_price, price_min, price_max, sort_order)
values
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000001', 'PDI',                   'New car pre-delivery inspection prep',       'new',     60.00, null, null, 10),
  ('00000000-0000-4000-8000-000000000209', '00000000-0000-4000-8000-000000000001', 'Sold',                  'Delivery clean on a sold unit',              'new',     20.00, null, null, 20),
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', 'Used',                  'Used car full detail',                       'used',   200.00, null, null, 30),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', 'Service Loaner Detail', 'Full detail on a service loaner',            'service', 125.00, null, null, 40),
  ('00000000-0000-4000-8000-000000000210', '00000000-0000-4000-8000-000000000001', 'Touch Up Detail',       'Quick touch-up; $20–40 by condition',        'addon',   30.00, 20.00, 40.00, 50),
  ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000001', 'Tint Removal',          'Strip old tint on a used unit',              'addon',   40.00, null, null, 60),
  ('00000000-0000-4000-8000-000000000207', '00000000-0000-4000-8000-000000000001', 'Paint Correction (1-step)', 'Single-stage machine polish',            'addon',  250.00, null, null, 70)
on conflict (id) do nothing;

-- Irvine negotiated a lower PDI rate and a higher used-car detail.
insert into public.dealership_service_prices (company_id, dealership_id, service_id, price)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000204', 55.00),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000201', 215.00)
on conflict (dealership_id, service_id) do nothing;
