// supabase/seed.sql (real projects) and src/lib/db/seed.ts (the mock store) describe the same starting data. Keep them in step.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bookingConfig, bookingServices } from '@/config/booking';
import { SEED_TECH_IDS, seedData } from '@/lib/db/seed';

const sql = readFileSync('supabase/seed.sql', 'utf8');
const demo = readFileSync('supabase/seed-demo.sql', 'utf8');

describe('seed.sql <-> seed.ts', () => {
  it('services: same ids, plain names, terms, photo and exterior flags and order', () => {
    const rows = [...sql.matchAll(/\('([a-z-]+)','([^']+)','([^']+)',\s*(true|false),\s*(true|false),\s*(\d+)\)/g)]
      .map((m) => ({ id: m[1]!, plain_name: m[2]!, term: m[3]!, requires_photos: m[4] === 'true', exterior: m[5] === 'true', sort: Number(m[6]) }));
    const mock = (seedData().services ?? []).map((s) => ({ id: s.id!, plain_name: s.plain_name!, term: s.term!, requires_photos: s.requires_photos!, exterior: s.exterior!, sort: s.sort! }));
    expect(rows).toEqual(mock);
    expect(rows.map((r) => r.id)).toEqual(bookingServices.map((s) => s.id));
  });
  it('technicians: same ids, names, home zip and colour', () => {
    const rows = [...sql.matchAll(/\('(00000000-0000-4000-8000-0000000000a[12])', '([^']+)', '(\d{5})', '(#[0-9A-Fa-f]{6})'\)/g)].map((m) => ({ id: m[1]!, name: m[2]!, home_zip: m[3]!, color: m[4]! }));
    const mock = (seedData().techs ?? []).map((t) => ({ id: t.id!, name: t.name!, home_zip: t.home_zip!, color: t.color! }));
    expect(rows).toEqual(mock);
    expect(rows.map((r) => r.id)).toEqual([...SEED_TECH_IDS]);
    expect(rows.every((r) => r.home_zip === bookingConfig.baseZip)).toBe(true);
  });
  it('weekly hours: the SQL rule (Mon-Fri 08-17, Sat 08-15, Sunday closed) equals bookingConfig.defaultWeekly and the mock availability rows', () => {
    expect(sql).toMatch(/generate_series\(1, 6\)/);
    expect(sql).toMatch(/time '08:00', case when d = 6 then time '15:00' else time '17:00' end/);
    const hh = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`;
    const fromConfig = Object.entries(bookingConfig.defaultWeekly).flatMap(([wd, ws]) => ws.map((w) => `${wd}:${hh(w.start)}-${hh(w.end)}`)).sort();
    expect(fromConfig).toEqual(['1:08:00:00-17:00:00', '2:08:00:00-17:00:00', '3:08:00:00-17:00:00', '4:08:00:00-17:00:00', '5:08:00:00-17:00:00', '6:08:00:00-15:00:00']);
    for (const tech of SEED_TECH_IDS) {
      const mock = (seedData().tech_availability ?? []).filter((a) => a.tech_id === tech).map((a) => `${a.weekday}:${a.start_time}-${a.end_time}`).sort();
      expect(mock).toEqual(fromConfig);
    }
  });
  it('the production seed contains no demo people; the demo dealer lives only in seed-demo.sql (and says never to run it in production)', () => {
    expect(sql).not.toMatch(/\[DEMO\]|insert into public\.dealers/);
    expect(demo).toMatch(/\[DEMO\] Sample Auto Group/);
    expect(demo).toMatch(/NEVER run this on the production/i);
  });
});
