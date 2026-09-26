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

-- Services are grouped the way a dealership buys them:
--   new     – PDI / new-car prep and delivery
--   used    – reconditioning for used, CPO and wholesale units
--   service – service-lane washes, loaners, showroom
--   addon   – tint, correction, extras that ride on any car
insert into public.services (id, company_id, name, description, category, default_price, sort_order)
values
  -- New
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000001', 'PDI (New Car Prep)',      'Pre-delivery inspection prep: transport film off, wash, interior wipe',   'new',     35.00, 10),
  ('00000000-0000-4000-8000-000000000209', '00000000-0000-4000-8000-000000000001', 'New Car Delivery',        'Final delivery wash + interior for a sold new unit',                        'new',     35.00, 20),
  -- Used
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', 'Used Car Detail (Full)',  'Full reconditioning: interior + exterior, clay, wax',                        'used',   150.00, 30),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000001', 'CPO Detail',              'Certified pre-owned standard: full detail + engine bay + trunk',              'used',   185.00, 40),
  ('00000000-0000-4000-8000-000000000212', '00000000-0000-4000-8000-000000000001', 'Wholesale Prep',          'Quick wash + vacuum for auction / wholesale units',                          'used',    60.00, 50),
  -- Service lane
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', 'Service Wash',            'Customer service wash + vacuum',                                             'service',  45.00, 60),
  ('00000000-0000-4000-8000-000000000210', '00000000-0000-4000-8000-000000000001', 'Loaner Return Clean',     'Loaner turn-around: wash, vacuum, wipe-down',                                'service',  35.00, 70),
  ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000001', 'Showroom Detail',         'Showroom / front-line unit refresh',                                         'service',  75.00, 80),
  -- Add-ons
  ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000001', 'Window Tint (Full)',      'Ceramic film, all side + rear glass',                                        'addon',  399.00, 90),
  ('00000000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000001', 'Window Tint (Front 2)',   'Ceramic film, front doors to match',                                         'addon',  149.00, 100),
  ('00000000-0000-4000-8000-000000000207', '00000000-0000-4000-8000-000000000001', 'Paint Correction (1-step)', 'Single-stage machine polish',                                              'addon',  250.00, 110),
  ('00000000-0000-4000-8000-000000000208', '00000000-0000-4000-8000-000000000001', 'Engine Bay',              'Degrease + dress',                                                           'addon',   40.00, 120),
  ('00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-000000000001', 'Headlight Restoration',   'Wet sand + polish + UV seal, pair',                                          'addon',   60.00, 130),
  ('00000000-0000-4000-8000-000000000214', '00000000-0000-4000-8000-000000000001', 'Odor Treatment',          'Ozone / enzyme treatment',                                                   'addon',   50.00, 140)
on conflict (id) do nothing;

-- Irvine negotiated a lower PDI rate and a higher full used-car detail.
insert into public.dealership_service_prices (company_id, dealership_id, service_id, price)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000204', 30.00),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000201', 165.00)
on conflict (dealership_id, service_id) do nothing;
