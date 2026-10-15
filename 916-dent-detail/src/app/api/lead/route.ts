import { SMS_CONSENT_TEXT } from '@/config/booking';
import { deriveSource } from '@/lib/attribution';
import { guard, limited, ok, parseJson, fail } from '@/lib/api/http';
import { leadSchema } from '@/lib/booking/schema';
import { repo } from '@/lib/db';
import { assessZip } from '@/lib/geo';
import { normalizePhone } from '@/lib/sms';

export const dynamic = 'force-dynamic';

/** Capture a lead that cannot be booked online (unknown or out-of-area ZIP). A human follows up. */
export async function POST(req: Request) {
  return guard('lead', async () => {
    const rl = await limited(req, 'lead', 6, 3600);
    if (rl) return rl;
    const p = await parseJson(req, leadSchema);
    if (!p.ok) return p.res;
    const d = p.data;
    const phone = d.phone ? normalizePhone(d.phone) : null;
    if (d.phone && !phone) return fail(400, 'invalid_phone', 'Enter a valid US phone number.');
    const db = repo();
    const a = d.attribution ?? {};
    const lead = await db.leads.insert({
      name: d.name, phone, email: d.email ?? null, zip: d.zip, stage: 'new', source: deriveSource(a), area_status: assessZip(d.zip).status,
      utm_source: a.utm_source ?? null, utm_medium: a.utm_medium ?? null, utm_campaign: a.utm_campaign ?? null, utm_term: a.utm_term ?? null, utm_content: a.utm_content ?? null,
      gclid: a.gclid ?? null, fbclid: a.fbclid ?? null, referrer: a.referrer ?? null, landing_page: a.landing_page ?? null,
      notes: [d.services.length ? `Services: ${d.services.join(', ')}` : '', d.notes ?? '', d.smsConsent ? `SMS consent given: "${SMS_CONSENT_TEXT.slice(0, 40)}…"` : ''].filter(Boolean).join('\n') || null,
    });
    await db.events.insert({ type: 'lead.created', entity_type: 'lead', entity_id: lead.id, actor: 'customer', data: { source: lead.source, area: lead.area_status } });
    return ok({ received: true }, { status: 201 });
  });
}
