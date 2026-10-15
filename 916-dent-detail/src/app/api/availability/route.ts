import { serviceById, TIMEZONE } from '@/config/booking';
import { guard, limited, ok, parseJson, fail } from '@/lib/api/http';
import { assessZip } from '@/lib/geo';
import { availabilityFor } from '@/lib/booking/loader';
import { availabilityQuerySchema } from '@/lib/booking/schema';
import { computeDuration, validateSelection } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return guard('availability', async () => {
    const rl = await limited(req, 'avail', 60, 60);
    if (rl) return rl;
    const p = await parseJson(req, availabilityQuerySchema);
    if (!p.ok) return p.res;
    const q = p.data;
    const sel = validateSelection(q.services, q.sizeClass, q.addons);
    if (!sel.ok) return fail(400, 'invalid_selection', sel.error);
    const area = assessZip(q.zip);
    if (area.status !== 'in_area') return fail(422, 'out_of_area', area.message, { area });
    const durationMin = computeDuration({ services: sel.services, sizeClass: sel.sizeClass, addons: sel.addons, panels: q.panels });
    const exterior = sel.services.some((s) => serviceById(s)?.exterior);
    const { slots, days, horizonDays } = await availabilityFor(Date.now(), { durationMin, zip: q.zip, exterior, fromDate: q.fromDate, days: q.days, excludeBookingId: q.excludeBookingId });
    return ok({
      timezone: TIMEZONE, durationMin, horizonDays, days,
      slots: slots.map((s) => ({ startsAt: s.startISO, endsAt: s.endISO, date: s.date, label: s.label, techId: s.techId })),
    });
  });
}
