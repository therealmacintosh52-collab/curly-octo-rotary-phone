import { describe, expect, it } from 'vitest';
import { buildTimeline, findDuplicateGroups } from '@/lib/admin/customers';
import { computeInvoice, lineTotal, parseLines, seedLines, subtotalOf, type LineItem } from '@/lib/admin/invoice';
import { money, moneyRange, round2, fmtPhone, localToday } from '@/lib/admin/format';
import type { Customer } from '@/lib/db';
import { addonPrices, fixedPrices, travelFees } from '@/config/pricing';

const cust = (id: string, over: Partial<Customer> = {}): Customer => ({ id, name: id, sms_opt_in: false, created_at: `2026-01-0${id.length}T00:00:00.000Z`, updated_at: '', ...over });

describe('duplicates', () => {
  it('groups by normalized phone, then email, without double-claiming', () => {
    const g = findDuplicateGroups([
      cust('a', { phone: '+19165550142', email: 'x@e.com' }), cust('bb', { phone: '(916) 555-0142', email: 'x@e.com' }),
      cust('ccc', { email: 'X@E.com' }), cust('dddd', { email: 'solo@e.com' }), cust('eeeee', { phone: '123' }), cust('ffffff', { phone: '123' }),
    ]);
    expect(g).toHaveLength(1); // a+bb by phone; ccc joins only by email with an already-claimed pair -> single leftover, no group
    expect(g[0]!.reason).toBe('phone');
    expect(g[0]!.customers.map((c) => c.id)).toEqual(['a', 'bb']);
  });
  it('email-only duplicates are found', () => {
    const g = findDuplicateGroups([cust('a', { email: 'Sam@x.com' }), cust('bb', { email: ' sam@x.com' }), cust('ccc')]);
    expect(g).toHaveLength(1);
    expect(g[0]!.reason).toBe('email');
  });
});

describe('timeline', () => {
  it('merges sources newest-first and skips tool/system messages', () => {
    const t = buildTimeline({
      leads: [{ id: 'l', stage: 'new', source: 'google', created_at: '2026-10-01T10:00:00.000Z', updated_at: '' }],
      quotes: [{ id: 'q', services: ['pdr'], low: 200, high: 400, panels: [], photo_paths: [], mock: true, label: '', created_at: '2026-10-01T11:00:00.000Z', updated_at: '' }],
      bookings: [{ id: 'b', status: 'cancelled', services: ['interior'], addons: [], starts_at: '2026-10-05T16:00:00.000Z', ends_at: '', duration_min: 60, travel_fee: 0, needs_review: false, deposit_amount: 50, deposit_status: 'refunded', reschedule_count: 0, cancelled_at: '2026-10-03T00:00:00.000Z', cancel_reason: 'sick', created_at: '2026-10-02T00:00:00.000Z', updated_at: '' }],
      jobs: [], invoices: [], payments: [{ id: 'p', kind: 'deposit', amount: 50, status: 'succeeded', mock: true, method: 'card', created_at: '2026-10-02T00:01:00.000Z', updated_at: '' }],
      notes: [{ id: 'n', entity_type: 'customer', entity_id: 'c', body: 'Gate code 1234', created_at: '2026-10-04T00:00:00.000Z', updated_at: '' }],
      conversations: [{ id: 'cv', channel: 'sms', status: 'open', cost_usd: 0, created_at: '', updated_at: '' }],
      messages: [
        { id: 'm1', conversation_id: 'cv', role: 'user', content: 'Can you do Saturday?', meta: {}, created_at: '2026-10-01T09:00:00.000Z', updated_at: '' },
        { id: 'm2', conversation_id: 'cv', role: 'tool', content: 'secret', meta: {}, created_at: '2026-10-01T09:00:01.000Z', updated_at: '' },
      ],
      events: [{ id: 'e', type: 'pipeline.stage_changed', data: { from: 'new', to: 'quoted' }, created_at: '2026-10-01T12:00:00.000Z', updated_at: '' }],
    });
    const times = t.map((x) => x.at);
    expect(times).toEqual([...times].sort().reverse());
    expect(t.some((x) => x.detail === 'secret')).toBe(false);
    expect(t.find((x) => x.kind === 'message')!.title).toContain('sms');
    expect(t.filter((x) => x.kind === 'booking')).toHaveLength(2);
    expect(t.find((x) => x.kind === 'pipeline')!.title).toBe('Stage new → quoted');
  });
});

describe('invoice math', () => {
  const L = (amount: number, kind: LineItem['kind'] = 'service', qty = 1): LineItem => ({ id: `${amount}-${kind}`, label: kind, amount, qty, kind });
  it('subtotal nets discounts; deposit is applied and capped; balance tracks payments and refunds', () => {
    const lines = [L(200), L(60, 'addon'), L(-25, 'credit')];
    expect(subtotalOf(lines)).toBe(235);
    const m = computeInvoice(lines, 50, [{ kind: 'balance', amount: 100, status: 'succeeded' }, { kind: 'balance', amount: 40, status: 'failed' }]);
    expect(m).toEqual({ subtotal: 235, depositApplied: 50, total: 185, paid: 100, balance: 85 });
    expect(computeInvoice([L(30)], 50).depositApplied).toBe(30); // never apply more deposit than the job is worth
    expect(computeInvoice([L(30)], 0, [{ kind: 'balance', amount: 30, status: 'succeeded' }, { kind: 'refund', amount: -10, status: 'succeeded' }]).balance).toBe(10);
    expect(computeInvoice([], 0).balance).toBe(0);
  });
  it('rounds to cents and handles qty', () => {
    expect(lineTotal({ amount: 33.33, qty: 3 })).toBe(99.99);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(subtotalOf([L(10.1, 'service', 3)])).toBe(30.3);
  });
  it('parseLines drops junk', () => {
    expect(parseLines([{ id: 'a', label: 'x', amount: 5 }, { id: 1 }, null, { id: 'b', label: 'y', amount: Infinity }])).toHaveLength(1);
    expect(parseLines('nope')).toEqual([]);
  });
  it('seedLines comes from config prices only (detailing at the low end, add-ons, travel)', () => {
    const lines = seedLines({ services: ['interior'], addons: ['pet-hair'], size_class: 'suv', travel_fee: travelFees.tiers[0]!.fee, price_low: null, price_high: null });
    expect(lines.map((l) => [l.kind, l.amount])).toEqual([['service', fixedPrices.interior!.suv], ['addon', addonPrices['pet-hair']], ['travel', travelFees.tiers[0]!.fee]]);
  });
  it('dent services without a quote seed no price (a human must set it)', () => {
    const lines = seedLines({ services: ['pdr'], addons: [], size_class: 'sedan', travel_fee: 0, price_low: null, price_high: null });
    expect(lines).toEqual([]);
  });
});

describe('format', () => {
  it('money / range / phone', () => {
    expect(money(1234)).toBe('$1,234');
    expect(money(12.5)).toBe('$12.50');
    expect(money(-5)).toBe('-$5');
    expect(money(null)).toBe('—');
    expect(moneyRange(100, 100)).toBe('$100');
    expect(moneyRange(null, null)).toBe('Needs photos');
    expect(fmtPhone('+19165550142')).toBe('(916) 555-0142');
    expect(localToday(Date.UTC(2026, 9, 15, 3, 0))).toBe('2026-10-14'); // 8pm PDT on the 14th
  });
});
