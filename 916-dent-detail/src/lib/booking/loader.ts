// Loads everything the pure availability engine needs from the repository.
import { bookingConfig } from '@/config/booking';
import { checkSlot, computeAvailability, type AvailabilityInput, type LiveBooking, type TechInfo } from '@/lib/availability/engine';
import { parseHHMM } from '@/lib/availability/tz';
import { repo } from '@/lib/db';
import { engineOverrides } from '@/lib/admin/settings';

export async function loadAvailabilityInput(now: number, request: AvailabilityInput['request']): Promise<AvailabilityInput> {
  const db = repo();
  const [config, techs, avail, blackouts, blocks, bookings, weather] = await Promise.all([
    engineOverrides(), // P3: owner-edited buffers/caps (falls back to config)
    db.techs.list({ where: { active: true } }),
    db.tech_availability.list(),
    db.blackout_dates.list(),
    db.admin_blocks.list({ ranges: [{ col: 'ends_at', gt: new Date(now).toISOString() }] }),
    db.bookings.list({ ranges: [{ col: 'ends_at', gt: new Date(now - 36 * 3600_000).toISOString() }], orderBy: 'starts_at' }),
    db.weather_flags.list(),
  ]);
  const tInfos: TechInfo[] = techs.map((t) => {
    const weekly: TechInfo['weekly'] = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const a of avail.filter((x) => x.tech_id === t.id)) weekly[a.weekday]!.push({ start: parseHHMM(a.start_time), end: parseHHMM(a.end_time) });
    return { id: t.id, name: t.name, active: t.active, homeZip: t.home_zip, weekly };
  });
  const live: LiveBooking[] = bookings.map((b) => ({
    id: b.id, techId: b.tech_id ?? null, start: Date.parse(b.starts_at), end: Date.parse(b.ends_at), zip: b.zip, status: b.status,
    holdExpiresAt: b.hold_expires_at ? Date.parse(b.hold_expires_at) : null,
  }));
  return {
    now, techs: tInfos,
    blackouts: blackouts.map((b) => ({ date: b.date, techId: b.tech_id ?? null })),
    blocks: blocks.map((b) => ({ techId: b.tech_id ?? null, start: Date.parse(b.starts_at), end: Date.parse(b.ends_at), reason: b.reason ?? undefined })),
    bookings: live,
    weatherFlags: Object.fromEntries(weather.map((w) => [w.date, w.reason ?? 'weather'])),
    request,
    config,
  };
}

export async function availabilityFor(now: number, request: AvailabilityInput['request']) {
  const input = await loadAvailabilityInput(now, request);
  const { slots, days } = computeAvailability(input);
  return { slots, days, horizonDays: bookingConfig.horizonDays };
}

export async function slotCheck(now: number, request: AvailabilityInput['request'], startMs: number, techId?: string | null) {
  return checkSlot(await loadAvailabilityInput(now, request), startMs, techId);
}
