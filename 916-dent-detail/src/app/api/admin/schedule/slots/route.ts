import { z } from 'zod';
import { serviceById, TIMEZONE } from '@/config/booking';
import { adminRoute } from '@/lib/admin/api';
import { primeSettings } from '@/lib/admin/settings';
import { ok, fail } from '@/lib/api/http';
import { availabilityQuerySchema } from '@/lib/booking/schema';
import { availabilityFor } from '@/lib/booking/loader';
import { STAFF } from '@/lib/auth/roles';
import { assessZip } from '@/lib/geo';
import { computeDuration, validateSelection } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

/** Staff slot finder: same engine as the public /api/availability, minus the public rate limit and with tech names. */
export async function POST(req: Request) {
  return adminRoute('admin.slots', req, STAFF, availabilityQuerySchema.extend({ durationMin: z.number().int().min(15).max(720).optional() }), async ({ body: q }) => {
    const sel = validateSelection(q.services, q.sizeClass, q.addons);
    if (!sel.ok) return fail(400, 'invalid_selection', sel.error);
    const area = assessZip(q.zip);
    await primeSettings();
    const durationMin = q.durationMin ?? computeDuration({ services: sel.services, sizeClass: sel.sizeClass, addons: sel.addons, panels: q.panels });
    const exterior = sel.services.some((s) => serviceById(s)?.exterior);
    const { slots, days } = await availabilityFor(Date.now(), { durationMin, zip: q.zip, exterior, fromDate: q.fromDate, days: q.days ?? 7, excludeBookingId: q.excludeBookingId });
    return ok({ timezone: TIMEZONE, durationMin, area: { status: area.status, message: area.message }, days, slots: slots.map((s) => ({ startsAt: s.startISO, date: s.date, label: s.label, techId: s.techId, techIds: s.techIds })) });
  });
}
