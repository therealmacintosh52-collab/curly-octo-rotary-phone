-- Seed data (idempotent). Mirrors src/lib/db/seed.ts, which feeds the mock store.
-- Tech names/phones are [OWNER] placeholders: replace with the two owner-technicians.
insert into public.services (id, plain_name, term, requires_photos, exterior, sort) values
  ('pdr','Dent Removal','Paintless dent repair (PDR)', true,  true, 1),
  ('hail','Hail Fix','Hail damage repair', true, true, 2),
  ('paint-correction','Swirl & Scratch Erase','Paint correction', false, true, 3),
  ('ceramic','Gloss Shield','Ceramic coating', false, true, 4),
  ('decon','Paint Deep-Clean','Clay bar & paint decontamination', false, true, 5),
  ('interior','Interior Reset','Interior detailing', false, false, 6)
on conflict (id) do update set plain_name = excluded.plain_name, term = excluded.term,
  requires_photos = excluded.requires_photos, exterior = excluded.exterior, sort = excluded.sort;

insert into public.techs (id, name, home_zip, color) values
  ('00000000-0000-4000-8000-0000000000a1', '[OWNER] Tech One', '95624', '#C9A24A'),
  ('00000000-0000-4000-8000-0000000000a2', '[OWNER] Tech Two', '95624', '#8C8F96')
on conflict (id) do nothing;

-- Mon-Sat 08:00-17:00 for both techs (weekday 0 = Sunday, so 1..6)
insert into public.tech_availability (tech_id, weekday, start_time, end_time)
select t.id, d, time '08:00', time '17:00'
from public.techs t, generate_series(1, 6) as d
where t.id in ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2')
  and not exists (select 1 from public.tech_availability a where a.tech_id = t.id and a.weekday = d);

-- Demo dealer for Phase 5 development
insert into public.dealers (id, name, contact_name, status, net_terms_days) values
  ('00000000-0000-4000-8000-0000000000d1', '[DEMO] Sample Auto Group', 'Demo Manager', 'active', 30)
on conflict (id) do nothing;
