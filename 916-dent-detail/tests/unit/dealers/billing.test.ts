import { describe, expect, it } from 'vitest';
import { aging, buildStatement, dueDate, effectiveInvoiceStatus, fromCents, localMidnightUtc, money, monthLabel, monthPeriod, previousMonth, toCents, type PricedVehicle } from '@/lib/dealers/billing';

const pv = (o: Partial<PricedVehicle> & { vehicle_id: string }): PricedVehicle => ({ stock_number: null, vin: null, label: 'Car', done_at: '2026-09-10T20:00:00Z', description: 'Work', price: 100, addons: [], ...o });

describe('statement math', () => {
  it('sums base + approved add-ons in cents (no float drift)', () => {
    const r = buildStatement([
      pv({ vehicle_id: 'a', price: 0.1, addons: [{ id: '1', label: 'x', price: 0.2, status: 'approved' }] }),
      pv({ vehicle_id: 'b', price: 199.99 }),
    ]);
    expect(r.totalCents).toBe(0.1 * 100 + 0.2 * 100 + 19999);
    expect(fromCents(r.totalCents)).toBe(200.29);
    expect(r.lines[0]!.total).toBe(0.3);
  });
  it('bills only approved add-ons; declined, proposed, draft and withdrawn are ignored', () => {
    const r = buildStatement([pv({ vehicle_id: 'a', price: 100, addons: [
      { id: '1', label: 'ok', price: 25, status: 'approved' }, { id: '2', label: 'no', price: 50, status: 'declined' },
      { id: '3', label: 'wait', price: 75, status: 'proposed' }, { id: '4', label: 'd', price: null, status: 'draft' }, { id: '5', label: 'w', price: 10, status: 'withdrawn' },
    ] })]);
    expect(r.lines[0]!.addons.map((a) => a.id)).toEqual(['1']);
    expect(r.lines[0]!.total).toBe(125);
  });
  it('holds back unpriced vehicles and approved add-ons without a price instead of billing $0', () => {
    const r = buildStatement([pv({ vehicle_id: 'a', price: null }), pv({ vehicle_id: 'b', price: 50, addons: [{ id: '1', label: 'x', price: null, status: 'approved' }] }), pv({ vehicle_id: 'c', price: 0 })]);
    expect(r.unpriced.map((v) => v.vehicle_id)).toEqual(['a', 'b']);
    expect(r.lines.map((l) => l.vehicle_id)).toEqual(['c']); // an explicit $0 (goodwill) is allowed
    expect(r.totalCents).toBe(0);
  });
  it('sorts by completion date then stock number', () => {
    const r = buildStatement([pv({ vehicle_id: 'a', stock_number: 'B', done_at: '2026-09-12T00:00:00Z' }), pv({ vehicle_id: 'b', stock_number: 'Z', done_at: '2026-09-01T00:00:00Z' }), pv({ vehicle_id: 'c', stock_number: 'A', done_at: '2026-09-12T00:00:00Z' })]);
    expect(r.lines.map((l) => l.vehicle_id)).toEqual(['b', 'c', 'a']);
  });
  it('cents helpers and money format', () => {
    expect(toCents(19.99)).toBe(1999); expect(toCents(0.1 + 0.2)).toBe(30); expect(fromCents(1999)).toBe(19.99);
    expect(money(1234.5)).toBe('$1,234.50');
  });
});

describe('billing periods (business time zone)', () => {
  it('monthPeriod gives calendar bounds and DST-correct UTC instants', () => {
    const p = monthPeriod('2026-10');
    expect(p).toMatchObject({ start: '2026-10-01', end: '2026-10-31' });
    expect(p.startUtc).toBe('2026-10-01T07:00:00.000Z'); // PDT = UTC-7
    expect(p.endUtc).toBe('2026-11-01T07:00:00.000Z'); // DST ends Nov 1 2026 at 2am, midnight is still PDT
    expect(monthPeriod('2026-11').endUtc).toBe('2026-12-01T08:00:00.000Z'); // PST = UTC-8
    expect(monthPeriod('2028-02').end).toBe('2028-02-29');
    expect(monthPeriod('2026-12').endUtc).toBe('2027-01-01T08:00:00.000Z');
  });
  it('rejects bad months', () => { expect(() => monthPeriod('2026-13')).toThrow(); expect(() => monthPeriod('26-1')).toThrow(); });
  it('previousMonth uses the business zone, including across the year boundary', () => {
    expect(previousMonth(new Date('2026-10-15T12:00:00Z'))).toBe('2026-09');
    expect(previousMonth(new Date('2027-01-01T03:00:00Z'))).toBe('2026-11'); // still Dec 31 evening in Sacramento
    expect(previousMonth(new Date('2027-01-01T09:00:00Z'))).toBe('2026-12');
  });
  it('localMidnightUtc and labels', () => {
    expect(localMidnightUtc('2026-03-08')).toBe('2026-03-08T08:00:00.000Z');
    expect(monthLabel('2026-09')).toBe('September 2026');
  });
});

describe('aging', () => {
  const now = Date.parse('2026-10-31T12:00:00Z');
  const day = 86_400_000;
  const inv = (total: number, daysAgoDue: number, status = 'sent') => ({ total, status, due_at: new Date(now - daysAgoDue * day).toISOString() });
  it('buckets unpaid invoices by days past due', () => {
    const a = aging([inv(100, -5), inv(200, 1), inv(300, 30), inv(400, 31), inv(500, 60), inv(600, 61), inv(700, 90), inv(800, 91)], now);
    expect(a).toEqual({ current: 100, d1_30: 500, d31_60: 900, d61_90: 1300, d90plus: 800, total: 3600, overdue: 3500 });
  });
  it('ignores paid, void and draft; counts overdue-status', () => {
    const a = aging([inv(100, 5, 'paid'), inv(100, 5, 'void'), inv(100, 5, 'draft'), inv(250, 5, 'overdue')], now);
    expect(a.total).toBe(250); expect(a.d1_30).toBe(250);
  });
  it('invoice with no due date counts as current; empty list is zeros', () => {
    expect(aging([{ total: 10, status: 'sent' }], now).current).toBe(10);
    expect(aging([], now).total).toBe(0);
  });
  it('dueDate and effective status', () => {
    expect(dueDate(Date.parse('2026-10-01T00:00:00Z'), 30)).toBe('2026-10-31T00:00:00.000Z');
    expect(dueDate(Date.parse('2026-10-01T00:00:00Z'), -5)).toBe('2026-10-01T00:00:00.000Z');
    expect(effectiveInvoiceStatus('sent', '2026-10-01T00:00:00Z', now)).toBe('overdue');
    expect(effectiveInvoiceStatus('sent', '2026-11-30T00:00:00Z', now)).toBe('sent');
    expect(effectiveInvoiceStatus('paid', '2026-10-01T00:00:00Z', now)).toBe('paid');
  });
});
