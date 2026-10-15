// Seed rows for the mock store. Mirrors supabase/seed.sql (keep the two in sync).
import { bookingConfig, bookingServices } from '@/config/booking';
import type { TableMap, TableName } from './types';

export const SEED_TECH_IDS = ['00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2'] as const;
export const SEED_DEALER_ID = '00000000-0000-4000-8000-0000000000d1';

type Seed = { [K in TableName]?: Partial<TableMap[K]>[] };

export function seedData(): Seed {
  const now = new Date().toISOString();
  const availability: Partial<TableMap['tech_availability']>[] = [];
  for (const techId of SEED_TECH_IDS) {
    for (const [wd, windows] of Object.entries(bookingConfig.defaultWeekly)) {
      for (const w of windows) {
        const hh = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`;
        availability.push({ id: `avail-${techId.slice(-2)}-${wd}-${w.start}`, tech_id: techId, weekday: Number(wd), start_time: hh(w.start), end_time: hh(w.end) });
      }
    }
  }
  return {
    services: bookingServices.map((s, i) => ({ id: s.id, plain_name: s.plain, term: s.term, requires_photos: s.requiresPhotos, exterior: s.exterior, active: true, sort: i + 1 })),
    techs: [
      { id: SEED_TECH_IDS[0], name: '[OWNER] Tech One', home_zip: bookingConfig.baseZip, color: '#C9A24A', active: true },
      { id: SEED_TECH_IDS[1], name: '[OWNER] Tech Two', home_zip: bookingConfig.baseZip, color: '#8C8F96', active: true },
    ],
    tech_availability: availability,
    dealers: [{ id: SEED_DEALER_ID, name: '[DEMO] Sample Auto Group', contact_name: 'Demo Manager', net_terms_days: 30, wholesale_pricing: {}, status: 'active', created_at: now }],
  } as Seed;
}
