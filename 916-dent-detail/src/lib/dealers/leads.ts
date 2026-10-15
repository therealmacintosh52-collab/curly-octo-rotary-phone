// "Request wholesale sheet" -> a CRM lead with source=dealer. We do not send the sheet automatically: prices are the
// owner's to set, so the owner follows up from /admin (and an alert email goes out when an inbox is configured).
import { deriveSource, type Attribution } from '@/lib/attribution';
import { repo } from '@/lib/db';
import type { Lead } from '@/lib/db/types';
import { normalizePhone } from '@/lib/sms';
import { notifyOwner, portalUrl } from './notify';

export type SheetRequest = { name: string; company: string; email: string; phone?: string | null; message?: string | null; attribution?: Attribution };

export async function createWholesaleLead(r: SheetRequest): Promise<Lead> {
  const a = r.attribution ?? {};
  const phone = r.phone ? normalizePhone(r.phone) : null;
  const lead = await repo().leads.insert({
    name: r.name.trim(), phone, email: r.email.trim().toLowerCase(), stage: 'new',
    // The dealer landing page is by definition a dealer lead, whatever the UTM says (leave_behind, door_knock, google ...).
    source: 'dealer',
    utm_source: a.utm_source ?? null, utm_medium: a.utm_medium ?? null, utm_campaign: a.utm_campaign ?? null, utm_term: a.utm_term ?? null, utm_content: a.utm_content ?? null,
    gclid: a.gclid ?? null, fbclid: a.fbclid ?? null, referrer: a.referrer ?? null, landing_page: a.landing_page ?? '/dealers',
    notes: [`Wholesale sheet request. Company: ${r.company.trim()}`, r.message?.trim() ? `Message: ${r.message.trim()}` : '', a.utm_source ? `Came from: ${deriveSource(a)} (utm_source=${a.utm_source})` : ''].filter(Boolean).join('\n'),
  });
  await notifyOwner('Wholesale sheet requested', `${r.company.trim()} asked for the wholesale sheet. Lead: ${portalUrl('/admin/leads')}`);
  return lead;
}
