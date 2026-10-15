// CRM record mutations (customers, vehicles, notes, quotes). Server-only callers validate input with zod first.
import { ESTIMATE_LABEL } from '@/config/pricing';
import { SIZE_CLASS_IDS } from '@/config/booking';
import { repo, type Customer, type Lead, type QuoteRow, type Vehicle } from '@/lib/db';
import { computePrice } from '@/lib/pricing';
import { normalizePhone } from '@/lib/sms';
import { HttpError } from './api';
import { logEvent } from './events';

export type CustomerInput = { name: string; phone?: string | null; email?: string | null };

export async function createCustomerRecord(i: CustomerInput, actor: string): Promise<{ customer: Customer; duplicates: Customer[] }> {
  const db = repo();
  const phone = i.phone?.trim() ? normalizePhone(i.phone) : null;
  if (i.phone?.trim() && !phone) throw new HttpError(400, 'invalid_phone', 'Enter a valid US phone number.');
  const email = i.email?.trim().toLowerCase() || null;
  const duplicates = [
    ...(phone ? await db.customers.list({ where: { phone } }) : []),
    ...(email ? await db.customers.list({ where: { email } }) : []),
  ].filter((c, ix, a) => a.findIndex((x) => x.id === c.id) === ix);
  const customer = await db.customers.insert({ name: i.name.trim(), phone, email, sms_opt_in: false });
  await logEvent('customer.created', 'customer', customer.id, actor, { manual: true });
  return { customer, duplicates };
}

export async function updateCustomerRecord(id: string, i: CustomerInput, actor: string): Promise<Customer> {
  const phone = i.phone?.trim() ? normalizePhone(i.phone) : null;
  if (i.phone?.trim() && !phone) throw new HttpError(400, 'invalid_phone', 'Enter a valid US phone number.');
  const c = await repo().customers.update(id, { name: i.name.trim(), phone, email: i.email?.trim().toLowerCase() || null });
  await logEvent('customer.updated', 'customer', id, actor, {});
  return c;
}

export type VehicleInput = { year?: number | null; make?: string | null; model?: string | null; color?: string | null; vin?: string | null; sizeClass?: string | null };

export async function saveVehicleRecord(customerId: string, i: VehicleInput, actor: string, id?: string): Promise<Vehicle> {
  const size = i.sizeClass && (SIZE_CLASS_IDS as readonly string[]).includes(i.sizeClass) ? (i.sizeClass as Vehicle['size_class']) : null;
  const patch = { year: i.year ?? null, make: i.make?.trim() || null, model: i.model?.trim() || null, color: i.color?.trim() || null, vin: i.vin?.trim().toUpperCase() || null, size_class: size };
  const v = id ? await repo().vehicles.update(id, patch) : await repo().vehicles.insert({ customer_id: customerId, ...patch });
  await logEvent(id ? 'vehicle.updated' : 'vehicle.created', 'vehicle', v.id, actor, {});
  return v;
}

export async function addNoteRecord(entityType: 'customer' | 'vehicle' | 'lead' | 'booking' | 'job', entityId: string, body: string, authorId: string | null, noteId?: string) {
  const text = body.trim();
  if (!text) throw new HttpError(400, 'empty_note', 'Write something first.');
  if (noteId) { const ex = await repo().notes.get(noteId); if (ex) return ex; }
  // author_id references profiles(id): only demo/live profile ids are valid there
  return repo().notes.insert({ ...(noteId ? { id: noteId } : {}), entity_type: entityType, entity_id: entityId, author_id: authorId, body: text.slice(0, 2000) });
}

export type QuoteInput = { leadId?: string | null; customerId?: string | null; vehicleId?: string | null; services: string[]; sizeClass: string; low: number | null; high: number | null; notes?: string | null };

/** Prices the config would suggest for these services (detailing only; dent work needs photos and a human). */
export function suggestQuote(services: string[], sizeClass: string): { low: number | null; high: number | null; note: string } {
  const r = computePrice({ services, sizeClass, addons: [], travelFee: 0 });
  if (!r.ok) return { low: null, high: null, note: r.error };
  if (r.status === 'needs_photos') return { low: null, high: null, note: 'Dent work has no fixed price. Set the range after reviewing photos.' };
  return { low: r.low, high: r.high, note: 'From config prices.' };
}

export async function createQuoteRecord(i: QuoteInput, actor: string): Promise<QuoteRow> {
  if (!i.services.length) throw new HttpError(400, 'services_required', 'Choose at least one service.');
  if (i.low != null && i.high != null && i.high < i.low) throw new HttpError(400, 'bad_range', 'The high price must be at least the low price.');
  let customerId = i.customerId ?? null;
  if (!customerId && i.leadId) customerId = (await repo().leads.get(i.leadId))?.customer_id ?? null;
  const q = await repo().quotes.insert({
    lead_id: i.leadId ?? null, customer_id: customerId, vehicle_id: i.vehicleId ?? null, services: i.services, size_class: i.sizeClass, low: i.low, high: i.high,
    panels: [], photo_paths: [], notes: i.notes?.trim().slice(0, 1000) || null, mock: false, label: ESTIMATE_LABEL,
  });
  await logEvent('quote.created', 'quote', q.id, actor, { manual: true });
  return q;
}

export async function getLeadWithCustomer(id: string): Promise<{ lead: Lead; customer: Customer | null } | null> {
  const lead = await repo().leads.get(id);
  if (!lead) return null;
  return { lead, customer: lead.customer_id ? await repo().customers.get(lead.customer_id) : null };
}
