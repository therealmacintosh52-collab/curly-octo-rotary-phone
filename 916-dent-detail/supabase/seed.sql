-- Seed data for a REAL project (idempotent: safe to run twice). Mirrors src/lib/db/seed.ts, which feeds the mock store; a test keeps them in step.
-- Run after migrations 0001-0005. Contains NO demo people: the sample dealer and sample customers live in seed-demo.sql (staging only).
-- Tech names are [OWNER] placeholders: rename them in the `techs` table (and add their profiles, README step 2.8).
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

-- Mon-Fri 08:00-17:00 and Saturday 08:00-15:00 for both techs (weekday 0 = Sunday, closed). Same as bookingConfig.defaultWeekly in
-- src/config/booking.ts; tests/unit/seed-coherence.test.ts fails if the two drift apart.
insert into public.tech_availability (tech_id, weekday, start_time, end_time)
select t.id, d, time '08:00', case when d = 6 then time '15:00' else time '17:00' end
from public.techs t, generate_series(1, 6) as d
where t.id in ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2')
  and not exists (select 1 from public.tech_availability a where a.tech_id = t.id and a.weekday = d);
