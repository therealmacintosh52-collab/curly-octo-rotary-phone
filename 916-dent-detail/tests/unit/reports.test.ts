import { describe, expect, it } from 'vitest';
import { adCpa, closeRate, revenueByService, revenueBySource, revenueByTech, summarize, totals, weekly, type ReportData } from '@/lib/reports/compute';
import { inRange, resolveRange, weekKey, weeksIn } from '@/lib/reports/range';
import { csvCell, toCsv } from '@/lib/reports/csv';
import { localToUtc } from '@/lib/availability/tz';
import type { AdSpend, BookingRow, Invoice, Job, Lead, QuoteRow, Tech } from '@/lib/db';

const NOW = localToUtc('2026-10-15', 12 * 60)!; // Thu
const iso = (date: string, h = 12) => new Date(localToUtc(date, h * 60)!).toISOString();
const base = { created_at: iso('2026-10-01'), updated_at: iso('2026-10-01') };

const techs: Tech[] = [{ id: 't1', name: '[OWNER] Alex', active: true, ...base }, { id: 't2', name: 'Blair', active: true, ...base }];
const inv = (id: string, job: string, booking: string, lines: Invoice['line_items'], subtotal: number, status: Invoice['status'] = 'paid'): Invoice =>
  ({ id, job_id: job, booking_id: booking, status, line_items: lines, subtotal, deposit_applied: 0, total: subtotal, ...base });
const job = (id: string, tech: string, finished: string | null, over: Partial<Job> = {}): Job => ({ id, booking_id: `b-${id}`, tech_id: tech, stage: 'done', finished_at: finished ? iso(finished) : null, ...base, ...over });
const bk = (id: string, lead: string, status: BookingRow['status']): BookingRow => ({ id, lead_id: lead, status, services: ['interior'], addons: [], starts_at: iso('2026-10-05'), ends_at: iso('2026-10-05', 14), duration_min: 120, travel_fee: 0, needs_review: false, deposit_amount: 50, deposit_status: 'paid', reschedule_count: 0, ...base });
const lead = (id: string, source: Lead['source'], created: string): Lead => ({ id, stage: 'new', source, ...base, created_at: iso(created) });
const line = (id: string, kind: string, amount: number, serviceId?: string) => ({ id, label: id, amount, qty: 1, kind, serviceId });

const data: ReportData = {
  techs,
  leads: [lead('L1', 'google', '2026-10-02'), lead('L2', 'google', '2026-10-03'), lead('L3', 'meta_ads', '2026-10-04'), lead('L4', 'door_knock', '2026-10-05'), lead('Lold', 'google', '2026-08-01')],
  quotes: [{ id: 'q1', lead_id: 'L1', services: ['interior'], panels: [], photo_paths: [], mock: false, label: '', ...base } as QuoteRow, { id: 'q2', lead_id: 'L2', services: ['pdr'], panels: [], photo_paths: [], mock: false, label: '', ...base } as QuoteRow],
  bookings: [bk('b-J1', 'L1', 'completed'), bk('b-J2', 'L3', 'completed'), bk('b-J3', 'L4', 'completed'), bk('b-J4', 'L2', 'cancelled'), bk('b-J5', 'L2', 'pending_deposit')],
  jobs: [
    job('J1', 't1', '2026-10-06', { reviewed_at: iso('2026-10-08'), review_requested_at: iso('2026-10-06') }),
    job('J2', 't2', '2026-10-07', { review_requested_at: iso('2026-10-07') }),
    job('J3', 't1', '2026-10-13', { reviewed_at: iso('2026-10-14') }),
    job('J-old', 't1', '2026-08-02'), job('J-open', 't1', null),
  ],
  invoices: [
    inv('I1', 'J1', 'b-J1', [line('s1', 'service', 200, 'interior'), line('a1', 'addon', 60), line('t1', 'travel', 25)], 285),
    inv('I2', 'J2', 'b-J2', [line('s2', 'service', 500, 'paint-correction'), line('c1', 'credit', -25)], 475),
    inv('I3', 'J3', 'b-J3', [line('s3', 'service', 300, 'interior'), line('x', 'custom', 40)], 340),
    inv('I-old', 'J-old', 'b-old', [line('s9', 'service', 999, 'ceramic')], 999),
    inv('I-void', 'J3', 'b-J3', [line('s8', 'service', 777, 'ceramic')], 777, 'void'),
    inv('I-draft', 'J-open', 'b-open', [line('s7', 'service', 123, 'ceramic')], 123, 'draft'),
  ],
  adSpend: [
    { id: 'a1', date: '2026-10-03', channel: 'google', spend: 100, ...base } as AdSpend, { id: 'a2', date: '2026-10-10', channel: 'google', spend: 50.5, ...base } as AdSpend,
    { id: 'a3', date: '2026-10-04', channel: 'meta_ads', spend: 80, ...base } as AdSpend, { id: 'a4', date: '2026-07-01', channel: 'google', spend: 999, ...base } as AdSpend,
  ],
};
const R = resolveRange('custom', { from: '2026-10-01', to: '2026-10-15' }, NOW);

describe('ranges', () => {
  it('presets resolve in Pacific days with inclusive ends', () => {
    const r30 = resolveRange('30d', {}, NOW);
    expect([r30.from, r30.to, r30.days]).toEqual(['2026-09-16', '2026-10-15', 30]);
    expect(resolveRange('7d', {}, NOW).from).toBe('2026-10-09');
    expect(resolveRange('mtd', {}, NOW).from).toBe('2026-10-01');
    const lm = resolveRange('last_month', {}, NOW);
    expect([lm.from, lm.to]).toEqual(['2026-09-01', '2026-09-30']);
    expect(resolveRange('ytd', {}, NOW).from).toBe('2026-01-01');
    expect(resolveRange('custom', { from: '2026-10-10', to: '2026-10-01' }, NOW).preset).toBe('30d'); // reversed -> fallback
    expect(resolveRange('nonsense', {}, NOW).preset).toBe('30d');
  });
  it('inRange is half-open at local midnight (DST-safe)', () => {
    const r = resolveRange('custom', { from: '2026-11-01', to: '2026-11-01' }, NOW); // the day clocks go back
    expect((r.endMs - r.startMs) / 3_600_000).toBe(25);
    expect(inRange(new Date(r.startMs).toISOString(), r)).toBe(true);
    expect(inRange(new Date(r.endMs).toISOString(), r)).toBe(false);
  });
  it('weeks are Monday-start and cover the whole range', () => {
    expect(weekKey(localToUtc('2026-10-15', 600)!)).toBe('2026-10-12');
    expect(weekKey(localToUtc('2026-10-18', 600)!)).toBe('2026-10-12'); // Sunday belongs to the Monday before
    expect(weeksIn({ from: '2026-10-01', to: '2026-10-15' })).toEqual(['2026-09-28', '2026-10-05', '2026-10-12']);
  });
});

describe('revenue', () => {
  it('counts only non-void, non-draft invoices of jobs finished in range', () => {
    expect(totals(data, R)).toEqual({ revenue: 1100, jobs: 3, avgTicket: 366.67 });
  });
  it('by service rows always sum to total revenue', () => {
    const rows = revenueByService(data, R);
    expect(rows.reduce((s, r) => s + r.revenue, 0)).toBe(1100);
    expect(rows.find((r) => r.key === 'interior')).toMatchObject({ revenue: 500, jobs: 2 });
    expect(rows.find((r) => r.key === '_addons')!.revenue).toBe(60);
    expect(rows.find((r) => r.key === '_travel')!.revenue).toBe(25);
    expect(rows.find((r) => r.key === '_discounts')!.revenue).toBe(-25);
    expect(rows.find((r) => r.key === '_other')!.revenue).toBe(40);
    expect(rows.map((r) => r.revenue)).toEqual([...rows.map((r) => r.revenue)].sort((a, b) => b - a)); // sorted by revenue desc
  });
  it('by source follows the lead (incl. manual overrides) and by tech follows the job', () => {
    expect(Object.fromEntries(revenueBySource(data, R).map((r) => [r.key, r.revenue]))).toEqual({ google: 285, meta_ads: 475, door_knock: 340 });
    expect(Object.fromEntries(revenueByTech(data, R).map((r) => [r.label, r.revenue]))).toEqual({ Alex: 625, Blair: 475 });
  });
  it('an invoice with no job counts by creation date; a booking with no lead is "direct"', () => {
    const d2: ReportData = { ...data, invoices: [inv('Ix', '', 'b-nolead', [line('s', 'service', 100, 'decon')], 100)] };
    d2.invoices[0]!.job_id = null; d2.invoices[0]!.created_at = iso('2026-10-10');
    expect(totals(d2, R).revenue).toBe(100);
    expect(revenueBySource(d2, R)[0]!.key).toBe('direct');
  });
});

describe('close rate', () => {
  it('funnels leads created in range: quoted+ -> booked -> done; expired holds are not bookings', () => {
    const f = closeRate(data, R);
    expect(f).toMatchObject({ leads: 4, quoted: 4, booked: 4, done: 3 });
    // L2 had a quote, a cancelled booking (counts as booked) and an unpaid hold
    expect(f.quoteToBook).toBe(1);
    expect(f.bookToDone).toBe(0.75);
    expect(f.leadToDone).toBe(0.75);
    expect(closeRate(data, R, 'google')).toMatchObject({ leads: 2, quoted: 2, booked: 2, done: 1 });
  });
  it('handles an empty range without dividing by zero', () => {
    const f = closeRate({ ...data, leads: [] }, R);
    expect(f).toMatchObject({ leads: 0, quoteToBook: null, bookToDone: null, leadToDone: null });
  });
});

describe('weekly + reviews', () => {
  it('buckets revenue, reviews and requests by Monday-start week, zero weeks included', () => {
    const w = weekly(data, R);
    expect(w.map((x) => x.week)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12']);
    expect(w.map((x) => x.revenue)).toEqual([0, 760, 340]);
    expect(w.map((x) => x.reviews)).toEqual([0, 1, 1]);
    expect(w.map((x) => x.requests)).toEqual([0, 2, 0]);
  });
});

describe('ad CPA', () => {
  it('spend / leads, booked, completed per channel for the range only', () => {
    const rows = adCpa(data, R);
    const g = rows.find((r) => r.channel === 'google')!;
    expect(g).toMatchObject({ spend: 150.5, leads: 2, booked: 2, done: 1, revenue: 285, cpl: 75.25, cpaBooked: 75.25, cpaDone: 150.5, roas: 1.89 });
    const m = rows.find((r) => r.channel === 'meta_ads')!;
    expect(m).toMatchObject({ spend: 80, leads: 1, done: 1, cpaDone: 80, roas: 5.94 });
    expect(rows.map((r) => r.channel)).toEqual(['google', 'meta_ads']);
  });
  it('a channel with spend and no leads has null CPA, not Infinity', () => {
    const rows = adCpa({ ...data, leads: [] }, R);
    expect(rows[0]).toMatchObject({ leads: 0, cpl: null, cpaBooked: null, cpaDone: null });
  });
  it('summary ties it together', () => {
    const s = summarize(data, R);
    expect(s.revenue).toBe(1100);
    expect(s.adSpend).toBe(230.5);
    expect(s.reviews).toBe(2);
    expect(s.reviewsPerWeek).toBe(0.93);
  });
});

describe('csv', () => {
  it('quotes, escapes and defuses formulas', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-2+3')).toBe("'-2+3");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell(-5)).toBe('-5'); // real numbers stay numeric
    expect(csvCell(null)).toBe('');
    expect(csvCell(Number.NaN)).toBe('');
  });
  it('builds rows with a header and CRLF', () => {
    expect(toCsv([{ a: 'x', b: 2 }], [{ header: 'A', value: (r) => r.a }, { header: 'B', value: (r) => r.b }])).toBe('A,B\r\nx,2\r\n');
  });
});
