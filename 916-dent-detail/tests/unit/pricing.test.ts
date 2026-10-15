import { describe, expect, it } from 'vitest';
import { computeDuration, computePrice, dentPerPanel, validateSelection, formatRange } from '@/lib/pricing';
import { ESTIMATE_LABEL, addonPrices, depositAmount, detailSpread, fixedPrices } from '@/config/pricing';
import { durations, dentMinutes, multiServiceSavingsMin, addonDefs } from '@/config/booking';

describe('pricing', () => {
  it('fixed service price comes from config with spread', () => {
    const r = computePrice({ services: ['interior'], sizeClass: 'suv' });
    if (!r.ok) throw new Error(r.error);
    expect(r.status).toBe('priced');
    expect(r.low).toBe(fixedPrices.interior!.suv);
    expect(r.high).toBe(Math.round(fixedPrices.interior!.suv * (1 + detailSpread)));
    expect(r.label).toBe(ESTIMATE_LABEL);
    expect(r.deposit).toBe(depositAmount);
  });
  it('price scales with vehicle size', () => {
    const lows = (['compact', 'sedan', 'suv', 'truck', 'xl'] as const).map((s) => { const r = computePrice({ services: ['ceramic'], sizeClass: s }); return r.ok ? r.low! : -1; });
    expect([...lows].sort((a, b) => a - b)).toEqual(lows);
  });
  it('dent without photo quote has NO price', () => {
    const r = computePrice({ services: ['pdr'], sizeClass: 'sedan' });
    if (!r.ok) throw new Error(r.error);
    expect(r.status).toBe('needs_photos');
    expect(r.low).toBeNull(); expect(r.high).toBeNull(); expect(r.totalLow).toBeNull();
  });
  it('dent with quote uses the quote range', () => {
    const r = computePrice({ services: ['pdr'], sizeClass: 'sedan', dentQuote: { low: 200, high: 400 }, travelFee: 25 });
    if (!r.ok) throw new Error(r.error);
    expect([r.low, r.high, r.totalLow, r.totalHigh]).toEqual([200, 400, 225, 425]);
  });
  it('multi-service: dent + detail needs photos for the dent part only, then sums', () => {
    const none = computePrice({ services: ['pdr', 'interior'], sizeClass: 'suv' });
    if (!none.ok) throw new Error(none.error);
    expect(none.status).toBe('needs_photos');
    const q = computePrice({ services: ['pdr', 'interior'], sizeClass: 'suv', dentQuote: { low: 150, high: 300 } });
    if (!q.ok) throw new Error(q.error);
    expect(q.low).toBe(150 + fixedPrices.interior!.suv);
    expect(q.lines).toHaveLength(2);
  });
  it('add-ons add flat prices and must apply to a selected service', () => {
    const r = computePrice({ services: ['interior'], sizeClass: 'sedan', addons: ['pet-hair'] });
    if (!r.ok) throw new Error(r.error);
    expect(r.low).toBe(fixedPrices.interior!.sedan + addonPrices['pet-hair']);
    expect(computePrice({ services: ['decon'], sizeClass: 'sedan', addons: ['pet-hair'] }).ok).toBe(false);
  });
  it('rejects empty / unknown input', () => {
    expect(validateSelection([], 'sedan').ok).toBe(false);
    expect(validateSelection(['nope'], 'sedan').ok).toBe(false);
    expect(validateSelection(['pdr'], 'bus').ok).toBe(false);
    expect(validateSelection(['pdr'], 'sedan', ['nope']).ok).toBe(false);
  });
  it('dedupes repeated services', () => {
    const v = validateSelection(['interior', 'interior'], 'sedan');
    expect(v.ok && v.services).toEqual(['interior']);
  });
  it('hail per-panel is multiplied and rounded', () => {
    const d = dentPerPanel('sedan', false); const h = dentPerPanel('sedan', true);
    expect(h.low).toBeGreaterThan(d.low); expect(h.high % 5).toBe(0);
  });
  it('formatRange collapses equal bounds', () => {
    expect(formatRange(100, 100)).toBe('$100');
    expect(formatRange(1000, 1200)).toBe('$1,000 – $1,200');
  });
});

describe('duration', () => {
  it('single service = config minutes', () => {
    expect(computeDuration({ services: ['decon'], sizeClass: 'sedan' })).toBe(durations.decon.sedan);
  });
  it('multi-service saves setup minutes per extra service (rounded to step)', () => {
    const d = computeDuration({ services: ['decon', 'interior'], sizeClass: 'sedan' });
    const raw = durations.decon.sedan + durations.interior.sedan - multiServiceSavingsMin;
    expect(d).toBe(Math.ceil(raw / 15) * 15);
  });
  it('add-ons add minutes', () => {
    const base = computeDuration({ services: ['interior'], sizeClass: 'suv' });
    const withAddon = computeDuration({ services: ['interior'], sizeClass: 'suv', addons: ['pet-hair'] });
    expect(withAddon - base).toBeGreaterThanOrEqual(addonDefs.find((a) => a.id === 'pet-hair')!.minutes - 14);
    expect(withAddon).toBeGreaterThan(base);
  });
  it('dent with panel count uses setup + per panel', () => {
    expect(computeDuration({ services: ['pdr'], sizeClass: 'sedan', panels: 3 })).toBe(Math.ceil((dentMinutes.setup + 3 * dentMinutes.perPanel) / 15) * 15);
  });
  it('bigger vehicles take at least as long', () => {
    for (const s of ['pdr', 'hail', 'paint-correction', 'ceramic', 'decon', 'interior'] as const) {
      const a = (['compact', 'sedan', 'suv', 'truck', 'xl'] as const).map((z) => computeDuration({ services: [s], sizeClass: z }));
      expect([...a].sort((x, y) => x - y)).toEqual(a);
    }
  });
  it('always a multiple of 15', () => {
    expect(computeDuration({ services: ['pdr', 'decon', 'interior'], sizeClass: 'xl', addons: ['odor', 'headlights'] }) % 15).toBe(0);
  });
  it('throws on bad input', () => expect(() => computeDuration({ services: [], sizeClass: 'sedan' })).toThrow());
});
