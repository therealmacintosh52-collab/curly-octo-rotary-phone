import { repo } from '@/lib/db';
import type { ReportData } from './compute';
import type { DateRange } from './range';

/**
 * Loads what the report functions need. Leads/quotes/ad spend are range-bounded; invoices, jobs and bookings are loaded
 * whole (a two-person shop produces a few thousand rows a year; the Supabase repo pages past the 1000-row cap).
 */
export async function loadReportData(r: Pick<DateRange, 'startMs' | 'endMs' | 'from' | 'to'>): Promise<ReportData> {
  const db = repo();
  const [invoices, jobs, bookings, leads, quotes, adSpend, techs] = await Promise.all([
    db.invoices.list(), db.jobs.list(), db.bookings.list(),
    db.leads.list({ ranges: [{ col: 'created_at', gte: new Date(r.startMs).toISOString(), lt: new Date(r.endMs).toISOString() }] }),
    db.quotes.list(),
    db.ad_spend.list({ ranges: [{ col: 'date', gte: r.from, lte: r.to }], orderBy: 'date' }),
    db.techs.list(),
  ]);
  return { invoices, jobs, bookings, leads, quotes, adSpend, techs };
}
