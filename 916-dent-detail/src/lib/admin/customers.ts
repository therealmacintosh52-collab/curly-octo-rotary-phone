// Customer search, detail bundle, activity timeline and duplicate detection.
// Pure helpers (timeline, duplicates) are unit tested; loaders call repo() only.
import { serviceById } from '@/config/booking';
import { repo, type BookingRow, type Conversation, type Customer, type EventRow, type Invoice, type Job, type Lead, type Membership, type Message, type Note, type Payment, type QuoteRow, type ReferralCode, type ReferralCredit, type Vehicle } from '@/lib/db';
import { normalizePhone } from '@/lib/sms';
import { money, sourceLabel, vehicleLabel } from './format';

export async function searchCustomers(q: string, limit = 40): Promise<Customer[]> {
  const db = repo();
  const term = q.trim();
  if (!term) return db.customers.list({ orderBy: 'created_at', desc: true, limit });
  const digits = term.replace(/\D/g, '');
  const e164 = normalizePhone(term);
  const cols = ['name', 'email', 'phone'] as const;
  const byText = await db.customers.list({ search: { cols: [...cols], q: term }, orderBy: 'created_at', desc: true, limit });
  // A typed phone ("916 555 0142") should find "+19165550142" whatever the punctuation.
  const extra = digits.length >= 4 && digits !== term
    ? await db.customers.list({ search: { cols: ['phone'], q: e164 ?? digits.slice(-10) }, limit })
    : [];
  const seen = new Set<string>();
  return [...byText, ...extra].filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true))).slice(0, limit);
}

export type CustomerBundle = {
  customer: Customer; vehicles: Vehicle[]; leads: Lead[]; quotes: QuoteRow[]; bookings: BookingRow[]; jobs: Job[]; invoices: Invoice[];
  payments: Payment[]; notes: Note[]; memberships: Membership[]; referralCode: ReferralCode | null; credits: ReferralCredit[];
  conversations: Conversation[]; messages: Message[]; events: EventRow[];
};

export async function loadCustomerBundle(id: string): Promise<CustomerBundle | null> {
  const db = repo();
  const customer = await db.customers.get(id);
  if (!customer) return null;
  const w = { customer_id: id };
  const [vehicles, leads, quotes, bookings, jobs, invoices, payments, notes, memberships, codes, conversations] = await Promise.all([
    db.vehicles.list({ where: w }), db.leads.list({ where: w, orderBy: 'created_at', desc: true }), db.quotes.list({ where: w, orderBy: 'created_at', desc: true }),
    db.bookings.list({ where: w, orderBy: 'starts_at', desc: true }), db.jobs.list({ where: w }), db.invoices.list({ where: w, orderBy: 'created_at', desc: true }),
    db.payments.list({ where: w, orderBy: 'created_at', desc: true }), db.notes.list({ where: { entity_type: 'customer', entity_id: id }, orderBy: 'created_at', desc: true }),
    db.memberships.list({ where: w }), db.referral_codes.list({ where: w }), db.conversations.list({ where: w }),
  ]);
  const messages = conversations.length
    ? await db.messages.list({ whereIn: [{ col: 'conversation_id', values: conversations.map((c) => c.id) }], orderBy: 'created_at', desc: true, limit: 200 })
    : [];
  const ids = [id, ...bookings.map((b) => b.id), ...jobs.map((j) => j.id), ...leads.map((l) => l.id)];
  const events = await db.events.list({ whereIn: [{ col: 'entity_id', values: ids }], orderBy: 'created_at', desc: true, limit: 200 });
  const referralCode = codes[0] ?? null;
  const credits = referralCode ? await db.referral_credits.list({ where: { referral_code_id: referralCode.id }, orderBy: 'created_at', desc: true }) : [];
  return { customer, vehicles, leads, quotes, bookings, jobs, invoices, payments, notes, memberships, referralCode, credits, conversations, messages, events };
}

export type TimelineKind = 'message' | 'booking' | 'note' | 'payment' | 'invoice' | 'lead' | 'quote' | 'job' | 'pipeline';
export type TimelineEntry = { at: string; kind: TimelineKind; title: string; detail?: string; href?: string };

const svc = (ids: string[]) => ids.map((s) => serviceById(s)?.plain ?? s).join(' + ');

/** Newest first. Pure: everything it needs is in the bundle. */
export function buildTimeline(b: Pick<CustomerBundle, 'leads' | 'quotes' | 'bookings' | 'jobs' | 'invoices' | 'payments' | 'notes' | 'messages' | 'events' | 'conversations'>): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  const chan = new Map(b.conversations.map((c) => [c.id, c.channel]));
  for (const m of b.messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    const via = chan.get(m.conversation_id) ?? 'chat';
    out.push({ at: m.created_at, kind: 'message', title: m.role === 'user' ? `Customer (${via})` : `Concierge (${via})`, detail: m.content.slice(0, 240) });
  }
  for (const l of b.leads) out.push({ at: l.created_at, kind: 'lead', title: `Lead from ${sourceLabel(l.source)}`, detail: l.notes?.split('\n')[0]?.slice(0, 160), href: `/admin/leads/${l.id}` });
  for (const q of b.quotes) out.push({ at: q.created_at, kind: 'quote', title: `Quote ${q.low != null && q.high != null ? `${money(q.low)}${q.high !== q.low ? ` – ${money(q.high)}` : ''}` : '(needs review)'}`, detail: svc(q.services), href: `/admin/quotes/${q.id}` });
  for (const k of b.bookings) {
    out.push({ at: k.created_at, kind: 'booking', title: `Booking ${k.status.replace(/_/g, ' ')}`, detail: `${svc(k.services)} · ${new Date(k.starts_at).toISOString().slice(0, 10)}`, href: `/admin/bookings/${k.id}` });
    if (k.cancelled_at) out.push({ at: k.cancelled_at, kind: 'booking', title: 'Booking cancelled', detail: k.cancel_reason ?? undefined, href: `/admin/bookings/${k.id}` });
  }
  for (const j of b.jobs) {
    if (j.started_at) out.push({ at: j.started_at, kind: 'job', title: 'Job started', href: `/admin/jobs/${j.id}` });
    if (j.finished_at) out.push({ at: j.finished_at, kind: 'job', title: 'Job finished', detail: j.final_price != null ? money(j.final_price) : undefined, href: `/admin/jobs/${j.id}` });
  }
  for (const i of b.invoices) out.push({ at: i.created_at, kind: 'invoice', title: `Invoice ${i.number ?? ''} ${i.status}`.trim(), detail: money(i.total), href: `/admin/invoices/${i.id}` });
  for (const p of b.payments) out.push({ at: p.created_at, kind: 'payment', title: `${p.kind === 'refund' ? 'Refund' : 'Payment'} ${money(p.amount)} (${p.method ?? 'card'})`, detail: `${p.kind}${p.mock ? ' · demo' : ''}${p.reference ? ` · ${p.reference}` : ''}` });
  for (const n of b.notes) out.push({ at: n.created_at, kind: 'note', title: 'Note', detail: n.body.slice(0, 400) });
  for (const e of b.events) {
    if (e.type === 'pipeline.stage_changed') out.push({ at: e.created_at, kind: 'pipeline', title: `Stage ${String(e.data.from ?? '?')} → ${String(e.data.to ?? '?')}`, detail: e.data.reason ? String(e.data.reason) : undefined });
  }
  return out.sort((a, c) => Date.parse(c.at) - Date.parse(a.at));
}

export type DuplicateGroup = { key: string; reason: 'phone' | 'email'; customers: Customer[] };

/** Group customers sharing a normalized phone or a lowercased email. A record can appear in at most one group per reason. */
export function findDuplicateGroups(customers: Customer[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const claimed = new Set<string>();
  const run = (reason: 'phone' | 'email', keyOf: (c: Customer) => string | null) => {
    const m = new Map<string, Customer[]>();
    for (const c of customers) { const k = keyOf(c); if (k) (m.get(k) ?? m.set(k, []).get(k)!).push(c); }
    for (const [key, list] of m) {
      const fresh = list.filter((c) => !claimed.has(c.id));
      if (fresh.length < 2) continue;
      fresh.forEach((c) => claimed.add(c.id));
      groups.push({ key, reason, customers: fresh.sort((a, b) => a.created_at.localeCompare(b.created_at)) });
    }
  };
  run('phone', (c) => normalizePhone(c.phone) ?? null);
  run('email', (c) => c.email?.trim().toLowerCase() || null);
  return groups;
}

export async function loadDuplicateGroups(): Promise<DuplicateGroup[]> {
  return findDuplicateGroups(await repo().customers.list({ orderBy: 'created_at' }));
}

export const customerSummaryLine = (c: Customer, v?: Vehicle | null): string => [c.phone, c.email, v ? vehicleLabel(v) : ''].filter(Boolean).join(' · ');
