// Data for the owner dashboard (kept out of the page so the page stays a pure render).
import { utcToLocal } from '@/lib/availability/tz';
import { repo, type BookingRow, type Customer, type Invoice, type Lead, type Membership } from '@/lib/db';
import { summarize, type Summary } from '@/lib/reports/compute';
import { loadReportData } from '@/lib/reports/load';
import { resolveRange } from '@/lib/reports/range';
import { localToday } from './format';
import { bookingsAffectedByWeather } from './schedule';

export type HomeData = {
  todays: BookingRow[]; customers: Map<string, Customer>; newLeads: Lead[]; owed: number; openInvoices: Invoice[]; pastDue: Membership[];
  needsPrice: number; weatherAffected: number; needsHuman: number; month: Summary;
};

export async function loadHome(now = Date.now()): Promise<HomeData> {
  const db = repo();
  const today = localToday(now);
  const r = resolveRange('mtd', {}, now);
  const [data, newLeads, invoices, bookings, pastDue, affected, review, inbox] = await Promise.all([
    loadReportData(r), db.leads.list({ where: { stage: 'new' }, orderBy: 'created_at', desc: true, limit: 6 }), db.invoices.list({ where: { status: 'sent' } }),
    db.bookings.list({ ranges: [{ col: 'starts_at', gte: new Date(now - 86_400_000).toISOString(), lt: new Date(now + 2 * 86_400_000).toISOString() }], orderBy: 'starts_at' }),
    db.memberships.list({ where: { status: 'past_due' } }), bookingsAffectedByWeather(), db.bookings.list({ where: { needs_review: true, status: 'confirmed' } }), db.conversations.list({ where: { needs_human: true }, limit: 100 }),
  ]);
  const todays = bookings.filter((b) => utcToLocal(Date.parse(b.starts_at)).date === today && ['confirmed', 'on_the_way', 'in_progress', 'completed'].includes(b.status));
  const ids = [...new Set(todays.map((b) => b.customer_id).filter((x): x is string => !!x))];
  const customers = new Map((ids.length ? await db.customers.list({ whereIn: [{ col: 'id', values: ids }] }) : []).map((c) => [c.id, c]));
  return { todays, customers, newLeads, owed: invoices.reduce((t, i) => t + i.total, 0), openInvoices: invoices, pastDue, needsPrice: review.length, needsHuman: inbox.length, weatherAffected: affected.length, month: summarize(data, r) };
}
