// Report math. Pure functions over plain rows so every number is unit tested. Definitions (also shown on the page):
//  * Revenue  = invoice.subtotal (net job value after discounts/credits, before the deposit split) of non-void invoices
//               whose job FINISHED in the range (accrual by completion date; not cash). Refunds of deposits on cancelled
//               bookings never create an invoice, so they do not appear here.
//  * By service: invoice line items with a serviceId; add-on, travel and credit/discount lines are their own rows, so
//               rows always sum to total revenue.
//  * By source: invoice -> booking -> lead.source (the CRM source, including manual overrides). By tech: job.tech_id.
//  * Close rate: leads CREATED in the range. Quoted+ = has a quote or a booking. Booked = has a booking that was actually
//               confirmed (not an expired/unpaid hold). Done = has a completed booking.
//  * Avg ticket = revenue / finished jobs with an invoice.
//  * Reviews/week = jobs marked reviewed (reviewed_at) per Monday-start week; requests = review_requested_at.
//  * Ad CPA = manual ad spend / leads, booked leads and completed jobs from that channel in the same range.
import { serviceById } from '@/config/booking';
import type { AdSpend, BookingRow, Invoice, Job, Lead, LeadSource, QuoteRow, Tech } from '@/lib/db';
import { parseLines } from '@/lib/admin/invoice';
import { round2 } from '@/lib/admin/format';
import { sourceLabel } from '@/lib/admin/format';
import { inRange, dateInRange, weekKey, weeksIn, type DateRange } from './range';

export type ReportData = { invoices: Invoice[]; jobs: Job[]; bookings: BookingRow[]; leads: Lead[]; quotes: QuoteRow[]; adSpend: AdSpend[]; techs: Tech[] };
export type Row = { key: string; label: string; revenue: number; jobs: number };

/** Invoices that count as revenue in the range, each with its job. */
export function revenueInvoices(d: ReportData, r: DateRange): { inv: Invoice; job: Job | null; at: string }[] {
  const jobs = new Map(d.jobs.map((j) => [j.id, j]));
  const out: { inv: Invoice; job: Job | null; at: string }[] = [];
  for (const inv of d.invoices) {
    if (inv.status === 'void' || inv.status === 'draft') continue;
    const job = inv.job_id ? jobs.get(inv.job_id) ?? null : null;
    const at = job?.finished_at ?? (job ? null : inv.created_at);
    if (at && inRange(at, r)) out.push({ inv, job, at });
  }
  return out;
}

const sortRows = (rows: Row[]) => rows.sort((a, b) => b.revenue - a.revenue || a.label.localeCompare(b.label));
function add(m: Map<string, Row>, key: string, label: string, rev: number, job: boolean) {
  const r = m.get(key) ?? { key, label, revenue: 0, jobs: 0 };
  r.revenue = round2(r.revenue + rev);
  if (job) r.jobs++;
  m.set(key, r);
}

export function revenueByService(d: ReportData, r: DateRange): Row[] {
  const m = new Map<string, Row>();
  for (const { inv } of revenueInvoices(d, r)) {
    const seen = new Set<string>();
    for (const l of parseLines(inv.line_items)) {
      const amt = l.amount * (l.qty || 1);
      let key: string, label: string;
      if (l.kind === 'service' && l.serviceId) { key = l.serviceId; label = serviceById(l.serviceId)?.plain ?? l.serviceId; }
      else if (l.kind === 'addon') { key = '_addons'; label = 'Add-ons'; }
      else if (l.kind === 'travel') { key = '_travel'; label = 'Travel fees'; }
      else if (l.kind === 'discount' || l.kind === 'credit') { key = '_discounts'; label = 'Discounts and credits'; }
      else { key = '_other'; label = 'Other work'; }
      add(m, key, label, amt, !seen.has(key)); seen.add(key);
    }
  }
  return sortRows([...m.values()]);
}

export function revenueBySource(d: ReportData, r: DateRange): Row[] {
  const leads = new Map(d.leads.map((l) => [l.id, l]));
  const bookings = new Map(d.bookings.map((b) => [b.id, b]));
  const m = new Map<string, Row>();
  for (const { inv } of revenueInvoices(d, r)) {
    const b = inv.booking_id ? bookings.get(inv.booking_id) : undefined;
    const src: string = (b?.lead_id ? leads.get(b.lead_id)?.source : undefined) ?? 'direct';
    add(m, src, sourceLabel(src), inv.subtotal, true);
  }
  return sortRows([...m.values()]);
}

export function revenueByTech(d: ReportData, r: DateRange): Row[] {
  const techs = new Map(d.techs.map((t) => [t.id, t.name.replace('[OWNER] ', '')]));
  const m = new Map<string, Row>();
  for (const { inv, job } of revenueInvoices(d, r)) {
    const id = job?.tech_id ?? '_none';
    add(m, id, id === '_none' ? 'Unassigned' : techs.get(id) ?? 'Former tech', inv.subtotal, true);
  }
  return sortRows([...m.values()]);
}

export function totals(d: ReportData, r: DateRange): { revenue: number; jobs: number; avgTicket: number | null } {
  const inv = revenueInvoices(d, r);
  const revenue = round2(inv.reduce((s, x) => s + x.inv.subtotal, 0));
  return { revenue, jobs: inv.length, avgTicket: inv.length ? round2(revenue / inv.length) : null };
}

export type Funnel = { leads: number; quoted: number; booked: number; done: number; quoteToBook: number | null; bookToDone: number | null; leadToDone: number | null };
const BOOKED = new Set<BookingRow['status']>(['confirmed', 'on_the_way', 'in_progress', 'completed', 'cancelled', 'no_show']);
const ratio = (a: number, b: number) => (b > 0 ? round2((a / b) * 100) / 100 : null);

export function closeRate(d: ReportData, r: DateRange, source?: LeadSource | null): Funnel {
  const leads = d.leads.filter((l) => inRange(l.created_at, r) && (!source || l.source === source));
  const quotesBy = new Set(d.quotes.map((q) => q.lead_id).filter(Boolean));
  const bookingsBy = new Map<string, BookingRow[]>();
  for (const b of d.bookings) if (b.lead_id) (bookingsBy.get(b.lead_id) ?? bookingsBy.set(b.lead_id, []).get(b.lead_id)!).push(b);
  let quoted = 0, booked = 0, done = 0;
  for (const l of leads) {
    const bs = bookingsBy.get(l.id) ?? [];
    const isBooked = bs.some((b) => BOOKED.has(b.status));
    const isDone = bs.some((b) => b.status === 'completed');
    if (quotesBy.has(l.id) || isBooked || isDone) quoted++;
    if (isBooked || isDone) booked++;
    if (isDone) done++;
  }
  return { leads: leads.length, quoted, booked, done, quoteToBook: ratio(booked, quoted), bookToDone: ratio(done, booked), leadToDone: ratio(done, leads.length) };
}

export type WeekPoint = { week: string; revenue: number; jobs: number; reviews: number; requests: number };
export function weekly(d: ReportData, r: DateRange): WeekPoint[] {
  const pts = new Map(weeksIn(r).map((w) => [w, { week: w, revenue: 0, jobs: 0, reviews: 0, requests: 0 }]));
  for (const { inv, at } of revenueInvoices(d, r)) { const p = pts.get(weekKey(Date.parse(at))); if (p) { p.revenue = round2(p.revenue + inv.subtotal); p.jobs++; } }
  for (const j of d.jobs) {
    if (inRange(j.reviewed_at, r)) { const p = pts.get(weekKey(Date.parse(j.reviewed_at!))); if (p) p.reviews++; }
    if (inRange(j.review_requested_at, r)) { const p = pts.get(weekKey(Date.parse(j.review_requested_at!))); if (p) p.requests++; }
  }
  return [...pts.values()];
}

export type CpaRow = { channel: LeadSource; label: string; spend: number; leads: number; booked: number; done: number; revenue: number; cpl: number | null; cpaBooked: number | null; cpaDone: number | null; roas: number | null };
export function adCpa(d: ReportData, r: DateRange): CpaRow[] {
  const spend = new Map<LeadSource, number>();
  for (const a of d.adSpend) if (dateInRange(a.date, r)) spend.set(a.channel, round2((spend.get(a.channel) ?? 0) + a.spend));
  const revBySource = new Map(revenueBySource(d, r).map((x) => [x.key, x.revenue]));
  const channels = new Set<LeadSource>([...spend.keys()]);
  const rows: CpaRow[] = [];
  for (const channel of channels) {
    const f = closeRate(d, r, channel);
    const s = spend.get(channel) ?? 0;
    rows.push({
      channel, label: sourceLabel(channel), spend: s, leads: f.leads, booked: f.booked, done: f.done, revenue: revBySource.get(channel) ?? 0,
      cpl: f.leads ? round2(s / f.leads) : null, cpaBooked: f.booked ? round2(s / f.booked) : null, cpaDone: f.done ? round2(s / f.done) : null,
      roas: s > 0 ? round2((revBySource.get(channel) ?? 0) / s) : null,
    });
  }
  return rows.sort((a, b) => b.spend - a.spend);
}

export type Summary = ReturnType<typeof summarize>;
export function summarize(d: ReportData, r: DateRange) {
  const t = totals(d, r);
  const f = closeRate(d, r);
  const wk = weekly(d, r);
  const reviews = wk.reduce((s, w) => s + w.reviews, 0);
  const adSpend = round2(d.adSpend.filter((a) => dateInRange(a.date, r)).reduce((s, a) => s + a.spend, 0));
  return {
    ...t, funnel: f, reviews, reviewsPerWeek: wk.length ? round2(reviews / Math.max(1, r.days / 7)) : 0, adSpend,
    byService: revenueByService(d, r), bySource: revenueBySource(d, r), byTech: revenueByTech(d, r), weekly: wk, cpa: adCpa(d, r),
  };
}
