-- SQL tests for 0072: past QuickBooks invoices kept as "already billed" lines.
-- Users: ...001 owner, ...002 detailer. Dealerships ...0101 (El Dorado Hills) and the second one.

create or replace function pg_temp.login(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, false);
  select set_config('role', 'authenticated', false);
$$;
create or replace function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', false);
  select set_config('request.jwt.claims', '', false);
$$;

do $$
declare c uuid := '00000000-0000-4000-8000-000000000001'; d1 uuid := '00000000-0000-4000-8000-000000000101'; d2 uuid;
begin
  select id into d2 from public.dealerships where company_id = c and id <> d1 and not retail limit 1;
  insert into public.quickbooks_billed_lines (company_id, dealership_id, qbo_invoice_id, doc_number, line_key, txn_date, service_date, stock_number, vin, description, amount, parsed_ok, source) values
    (c, d1, '501', '1001', '1', '2025-03-31', '2025-03-12', 'Z4821', null, 'Mar 12 · Stock Z4821 · 2024 GLE 450 · Used', 200, true, 'history'),
    (c, d1, '501', '1001', '2', '2025-03-31', '2025-03-12', null, 'W1KZF8DB5NA123456', 'detail W1KZF8DB5NA123456', 60, true, 'history'),
    (c, d2, '502', '1002', '1', '2025-04-30', '2025-04-02', 'Z4821', null, 'Stock Z4821 PDI', 60, true, 'history'),
    (c, d1, '503', '1003', '1', '2025-05-31', null, null, null, 'Detailing services, May', 80, false, 'history'),
    (c, d1, '504', '1004', '1', '2026-10-01', '2026-10-01', 'LIVE9', null, 'Oct 1 · Stock LIVE9 · Used', 200, true, 'app');
  -- re-running an import changes nothing (idempotent by invoice line)
  insert into public.quickbooks_billed_lines (company_id, dealership_id, qbo_invoice_id, line_key, stock_number, source) values (c, d1, '501', '1', 'Z4821', 'history') on conflict (company_id, qbo_invoice_id, line_key) do nothing;
  assert (select count(*) from public.quickbooks_billed_lines where qbo_invoice_id = '501') = 2, '0072: a line is stored once per invoice line';
end $$;

-- The table is closed to the app; the lookup works for any member and shows no money to a detailer
select pg_temp.login('10000000-0000-4000-8000-000000000002');
do $$
declare r record; n int;
begin
  begin perform * from public.quickbooks_billed_lines; raise exception 'expected no access'; exception when insufficient_privilege then null; end;
  select count(*) into n from public.find_quickbooks_billed('z4821', null, '00000000-0000-4000-8000-000000000101');
  assert n = 1, '0072: the stock number matches at the same dealership, case-insensitively: ' || n;
  select * into r from public.find_quickbooks_billed('Z4821', null, '00000000-0000-4000-8000-000000000101');
  assert r.doc_number = '1001' and r.billed_on = '2025-03-12' and r.amount is null, '0072: the hit names the invoice and date, and a detailer sees no amount';
  select count(*) into n from public.find_quickbooks_billed('Z4821', null, null);
  assert n = 2, '0072: with no dealership named, both dealerships match: ' || n;
  select count(*) into n from public.find_quickbooks_billed('NOPE1', 'w1kzf8db5na123456', null);
  assert n = 1, '0072: a VIN matches on its own, any case';
  select count(*) into n from public.find_quickbooks_billed('LIVE9', null, null);
  assert n = 0, '0072: a line the app itself pushed never matches';
  select count(*) into n from public.find_quickbooks_billed('  ', null, null);
  assert n = 0, '0072: a blank tag matches nothing';
  assert public.quickbooks_history_stats() is null, '0072: only the owner sees the import summary';
end $$;
select pg_temp.logout();

select pg_temp.login('10000000-0000-4000-8000-000000000001');
do $$
declare r record; s jsonb;
begin
  select * into r from public.find_quickbooks_billed('Z4821', null, '00000000-0000-4000-8000-000000000101');
  assert r.amount = 200, '0072: the owner sees the amount';
  s := public.quickbooks_history_stats();
  assert (s ->> 'lines')::int = 4 and (s ->> 'unread')::int = 1 and (s ->> 'invoices')::int = 3, '0072: the summary counts history lines only: ' || s::text;
end $$;
select pg_temp.logout();
