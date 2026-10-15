import { NextResponse } from 'next/server';
import { adminRoute } from '@/lib/admin/api';
import { fail } from '@/lib/api/http';
import { STAFF } from '@/lib/auth/roles';
import { adCpa, closeRate, revenueBySource, revenueByService, revenueByTech, revenueInvoices, weekly } from '@/lib/reports/compute';
import { toCsv } from '@/lib/reports/csv';
import { loadReportData } from '@/lib/reports/load';
import { resolveRange } from '@/lib/reports/range';

export const dynamic = 'force-dynamic';

const TYPES = ['service', 'source', 'tech', 'weekly', 'cpa', 'funnel', 'invoices', 'adspend'] as const;

export async function GET(req: Request) {
  return adminRoute('admin.reports.csv', req, STAFF, null, async () => {
    const u = new URL(req.url);
    const type = u.searchParams.get('type') ?? '';
    if (!(TYPES as readonly string[]).includes(type)) return fail(400, 'invalid_input', 'Unknown report.');
    const r = resolveRange(u.searchParams.get('preset') ?? undefined, { from: u.searchParams.get('from') ?? undefined, to: u.searchParams.get('to') ?? undefined });
    const d = await loadReportData(r);
    let csv = '';
    const money = (n: number) => n;
    if (type === 'service' || type === 'source' || type === 'tech') {
      const rows = type === 'service' ? revenueByService(d, r) : type === 'source' ? revenueBySource(d, r) : revenueByTech(d, r);
      csv = toCsv(rows, [{ header: type, value: (x) => x.label }, { header: 'revenue_usd', value: (x) => money(x.revenue) }, { header: 'jobs', value: (x) => x.jobs }]);
    } else if (type === 'weekly') {
      csv = toCsv(weekly(d, r), [{ header: 'week_starting', value: (x) => x.week }, { header: 'revenue_usd', value: (x) => x.revenue }, { header: 'jobs', value: (x) => x.jobs }, { header: 'reviews', value: (x) => x.reviews }, { header: 'review_requests', value: (x) => x.requests }]);
    } else if (type === 'cpa') {
      csv = toCsv(adCpa(d, r), [{ header: 'channel', value: (x) => x.label }, { header: 'spend_usd', value: (x) => x.spend }, { header: 'leads', value: (x) => x.leads }, { header: 'booked', value: (x) => x.booked }, { header: 'completed', value: (x) => x.done }, { header: 'revenue_usd', value: (x) => x.revenue }, { header: 'cost_per_lead', value: (x) => x.cpl }, { header: 'cost_per_booked', value: (x) => x.cpaBooked }, { header: 'cost_per_completed', value: (x) => x.cpaDone }, { header: 'roas', value: (x) => x.roas }]);
    } else if (type === 'funnel') {
      const f = closeRate(d, r);
      csv = toCsv([f], [{ header: 'leads', value: (x) => x.leads }, { header: 'quoted_or_booked', value: (x) => x.quoted }, { header: 'booked', value: (x) => x.booked }, { header: 'completed', value: (x) => x.done }, { header: 'quote_to_book', value: (x) => x.quoteToBook }, { header: 'book_to_done', value: (x) => x.bookToDone }, { header: 'lead_to_done', value: (x) => x.leadToDone }]);
    } else if (type === 'invoices') {
      csv = toCsv(revenueInvoices(d, r), [{ header: 'invoice', value: (x) => x.inv.number }, { header: 'finished_at', value: (x) => x.at }, { header: 'status', value: (x) => x.inv.status }, { header: 'subtotal_usd', value: (x) => x.inv.subtotal }, { header: 'deposit_applied_usd', value: (x) => x.inv.deposit_applied }, { header: 'due_after_deposit_usd', value: (x) => x.inv.total }]);
    } else {
      csv = toCsv(d.adSpend, [{ header: 'date', value: (x) => x.date }, { header: 'channel', value: (x) => x.channel }, { header: 'spend_usd', value: (x) => x.spend }, { header: 'notes', value: (x) => x.notes }]);
    }
    return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="916-${type}-${r.from}_to_${r.to}.csv"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  });
}
