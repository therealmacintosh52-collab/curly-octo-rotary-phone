import { describe, expect, it } from 'vitest';
import { computeCheckDigit, decodeVinOffline, decodeVinVpic, makeHintFromVin, modelYearFromVin, normalizeVin, validateVin } from '@/lib/dealers/vin';

const GOOD = '1HGCM82633A004352'; // widely published valid example (2003 Honda Accord)
const GOOD_X = '1M8GDM9AXKP042788'; // check digit "X" (remainder 10)

describe('VIN validation', () => {
  it('accepts valid VINs including an X check digit, any case, with spaces/dashes', () => {
    expect(validateVin(GOOD)).toEqual({ ok: true, vin: GOOD });
    expect(validateVin(GOOD_X).ok).toBe(true);
    expect(validateVin(' 1hgcm826-33a004352 ')).toEqual({ ok: true, vin: GOOD });
    expect(validateVin('11111111111111111').ok).toBe(true);
  });
  it('rejects wrong length with the count', () => {
    const r = validateVin('1HGCM82633A00435');
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.reason).toBe('length'); expect(r.message).toContain('16'); }
    expect(validateVin('').ok).toBe(false);
  });
  it('rejects I, O and Q', () => {
    for (const ch of ['I', 'O', 'Q']) {
      const r = validateVin(GOOD.slice(0, 5) + ch + GOOD.slice(6));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('chars');
    }
  });
  it('rejects punctuation inside the VIN', () => {
    const r = validateVin('1HGCM8263*A004352');
    expect(r.ok).toBe(false);
  });
  it('rejects a bad check digit (one mistyped character)', () => {
    const bad = GOOD.slice(0, 11) + '5' + GOOD.slice(12);
    const r = validateVin(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('check_digit');
  });
  it('computeCheckDigit matches position 9 of valid VINs', () => {
    expect(computeCheckDigit(GOOD)).toBe('3');
    expect(computeCheckDigit(GOOD_X)).toBe('X');
    expect(computeCheckDigit('short')).toBeNull();
  });
  it('normalizes', () => { expect(normalizeVin(' ab-cd ef ')).toBe('ABCDEF'); });
});

describe('VIN offline decode', () => {
  it('model year from position 10 disambiguated by position 7', () => {
    expect(modelYearFromVin(GOOD, new Date('2026-10-15'))).toBe(2003); // pos10 "3", pos7 "2" digit => 1980-2009 cycle
    // pos 7 alpha => 2010+ cycle: build "…K" at pos 10 with pos 7 = "A" -> 2019
    const v = '1HGCM8A63KA004352';
    expect(modelYearFromVin(v, new Date('2026-10-15'))).toBe(2019);
  });
  it('never returns a year beyond next model year', () => {
    const v = '1HGCM8A63TA004352'; // T = 1996 / 2026 (alpha pos7 => 2026)
    expect(modelYearFromVin(v, new Date('2026-10-15'))).toBe(2026);
    expect(modelYearFromVin(v, new Date('2020-01-01'))).toBe(1996);
  });
  it('make hint is conservative: known WMI only', () => {
    expect(makeHintFromVin(GOOD)).toBe('Honda');
    expect(makeHintFromVin('ZZZ00000000000000')).toBeNull();
    expect(decodeVinOffline(GOOD, new Date('2026-10-15'))).toEqual({ year: 2003, make: 'Honda', model: null, source: 'offline' });
  });
});

describe('vPIC decode (live mode only: injected fetch)', () => {
  const resp = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
  it('maps the response and title-cases the make', async () => {
    const d = await decodeVinVpic(GOOD, resp({ Results: [{ ModelYear: '2003', Make: 'HONDA', Model: 'Accord' }] }));
    expect(d).toEqual({ year: 2003, make: 'Honda', model: 'Accord', source: 'vpic' });
  });
  it('returns null for invalid VINs without calling the network', async () => {
    let called = false;
    const f = (async () => { called = true; return { ok: true, json: async () => ({}) }; }) as unknown as typeof fetch;
    expect(await decodeVinVpic('BADVIN', f)).toBeNull();
    expect(called).toBe(false);
  });
  it('returns null on HTTP errors and exceptions', async () => {
    expect(await decodeVinVpic(GOOD, resp({}, false))).toBeNull();
    expect(await decodeVinVpic(GOOD, (async () => { throw new Error('net'); }) as unknown as typeof fetch)).toBeNull();
  });
});
