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

insert into public.services (id, company_id, name, description, default_price, sort_order)
values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', 'Full Detail',        'Interior + exterior, clay, wax',           150.00, 10),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', 'Exterior Wash & Wax', 'Hand wash, dry, spray wax',               45.00,  20),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000001', 'Interior Detail',    'Vacuum, shampoo, leather condition',       85.00,  30),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000001', 'Delivery Prep',      'New-car delivery wash + interior wipe',   35.00,  40),
  ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000001', 'Window Tint (Full)', 'Ceramic film, all side + rear glass',     399.00, 50),
  ('00000000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000001', 'Window Tint (Front 2)', 'Ceramic film, front doors to match',  149.00, 60),
  ('00000000-0000-4000-8000-000000000207', '00000000-0000-4000-8000-000000000001', 'Paint Correction (1-step)', 'Single-stage machine polish',    250.00, 70),
  ('00000000-0000-4000-8000-000000000208', '00000000-0000-4000-8000-000000000001', 'Engine Bay',         'Degrease + dress',                        40.00,  80)
on conflict (id) do nothing;

-- Irvine negotiated a lower delivery-prep rate and a higher full detail.
insert into public.dealership_service_prices (company_id, dealership_id, service_id, price)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000204', 30.00),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000201', 165.00)
on conflict (dealership_id, service_id) do nothing;
