import { describe, expect, it } from 'vitest';
import { BULK_LIMITS, parseCsv, parseDelimited, templateCsv, validateRows } from '@/lib/dealers/csv';
import { computeCheckDigit } from '@/lib/dealers/vin';
import { parseServiceList, resolveRate, suggestPrice } from '@/lib/dealers/catalog';

const V1 = '1HGCM82633A004352';
const V2 = '1M8GDM9AXKP042788';
const NOW = new Date('2026-10-15T12:00:00Z');
/** Build a check-digit-valid VIN from a 16-char stem (position 9 is computed). */
const vinFrom = (stem: string) => { const raw = stem.slice(0, 8) + '0' + stem.slice(8, 16); return raw.slice(0, 8) + computeCheckDigit(raw) + raw.slice(9); };
const V3 = vinFrom('1FTEW1EP' + 'KFA00001'); const V4 = vinFrom('1G1ZT53F' + 'X6F00002'); const V5 = vinFrom('5YJ3E1EA' + 'XKF00003');

describe('CSV parsing', () => {
  it('handles quotes, embedded commas/newlines, CRLF, BOM', () => {
    const t = '﻿vin,stock,notes\r\n' + `${V1},A1,"left door, ding\nsecond line ""quoted"""\r\n` + `${V2},A2,plain\r\n`;
    const p = parseCsv(t);
    expect(p.errors).toEqual([]);
    expect(p.rows).toHaveLength(2);
    expect(p.rows[0]!.cells.notes).toBe('left door, ding\nsecond line "quoted"');
    expect(p.rows[0]!.line).toBe(2);
    expect(p.rows[1]!.line).toBe(4); // line numbers count the embedded newline
  });
  it('sniffs tab (Excel paste) and semicolon delimiters', () => {
    expect(parseCsv(`VIN\tStock #\tYear\n${V1}\tA1\t2003`).rows[0]!.cells).toMatchObject({ vin: V1, stock_number: 'A1', year: '2003' });
    expect(parseCsv(`vin;stock\n${V1};A9`).rows[0]!.cells.stock_number).toBe('A9');
  });
  it('maps header aliases and ignores unknown columns', () => {
    const p = parseCsv(`VIN #,Stk,Colour,Comments,Whatever\n${V1},A1,Red,hi,zz`);
    expect(p.rows[0]!.cells).toMatchObject({ vin: V1, stock_number: 'A1', color: 'Red', notes: 'hi' });
    expect(p.headers).toEqual(['vin', 'stock_number', 'color', 'notes']);
  });
  it('requires a vin header and reports empty input', () => {
    expect(parseCsv('stock,year\nA1,2020').errors[0]).toMatch(/vin/i);
    expect(parseCsv('').errors[0]).toMatch(/nothing/i);
    expect(parseCsv('   \n  ').rows).toHaveLength(0);
  });
  it('skips blank lines and caps rows / bytes', () => {
    const many = ['vin', ...Array.from({ length: BULK_LIMITS.maxRows + 5 }, (_, i) => `X${i}`)].join('\n');
    const p = parseCsv(many);
    expect(p.rows).toHaveLength(BULK_LIMITS.maxRows);
    expect(p.errors.join(' ')).toMatch(/too many/i);
    expect(parseCsv('x'.repeat(BULK_LIMITS.maxBytes + 1)).errors[0]).toMatch(/too large/i);
    expect(parseCsv(`vin\n\n${V1}\n\n`).rows).toHaveLength(1);
  });
  it('parseDelimited keeps a trailing record without newline', () => {
    expect(parseDelimited('a,b\nc,d', ',')).toEqual([{ line: 1, fields: ['a', 'b'] }, { line: 2, fields: ['c', 'd'] }]);
  });
  it('the downloadable template parses and its sample rows are valid VINs', () => {
    const p = parseCsv(templateCsv());
    expect(p.errors).toEqual([]);
    const r = validateRows(p.rows, { now: NOW });
    expect(r.every((x) => x.ok)).toBe(true);
  });
});

describe('row validation: per-row error report', () => {
  const rows = (lines: string[]) => parseCsv(['vin,stock_number,year,make,model,panels,services,notes', ...lines].join('\n')).rows;
  it('flags each problem on its own row with a useful message', () => {
    const r = validateRows(rows([
      `${V1},A1,2003,,,2,dent;interior,ok`,           // ok
      `${V1},A2,,,,,,`,                               // duplicate of line 2 in same file
      `1HGCM82633A004353,A3,,,,,,`,                   // bad check digit
      `${V2},A4,1950,,,,,`,                           // year out of range
      `${V3},A5,,,,x,,`,                              // bad panels
      `${V4},A6,,,,,paint magic,`,                    // unknown service
      `SHORT,A7,,,,,,`,                               // length
    ]), { now: NOW });
    expect(r.map((x) => x.ok)).toEqual([true, false, false, false, false, false, false]);
    expect(r[1]!.errors[0]).toMatch(/Duplicate VIN.*line 2/);
    expect(r[2]!.errors[0]).toMatch(/Check digit/);
    expect(r[3]!.errors[0]).toMatch(/1981/);
    expect(r[4]!.errors[0]).toMatch(/Panels/);
    expect(r[5]!.errors[0]).toMatch(/Unknown service: paint magic/);
    expect(r[6]!.errors[0]).toMatch(/17 characters/);
    expect(r[0]!.value).toMatchObject({ vin: V1, stock_number: 'A1', year: 2003, panels: 2, decoded: 'csv' });
    expect(r[0]!.value!.services).toEqual([{ id: 'pdr_panel', panels: 2 }, { id: 'interior_reset' }]);
  });
  it('refuses a VIN already open on the dealer account', () => {
    const r = validateRows(rows([`${V1},A1,,,,,,`]), { existingOpen: new Map([[V1, 'stock A1, submitted']]), now: NOW });
    expect(r[0]!.ok).toBe(false);
    expect(r[0]!.errors[0]).toMatch(/Already submitted/);
  });
  it('fills year and make from the VIN (offline) when blank, but never overrides CSV values', () => {
    const r = validateRows(rows([`${V1},A1,,,,,,`, `${V2},A2,2019,Jeep,,,,`]), { now: NOW });
    expect(r[0]!.value).toMatchObject({ year: 2003, make: 'Honda', decoded: 'offline' });
    expect(r[1]!.value).toMatchObject({ year: 2019, make: 'Jeep', decoded: 'csv' });
  });
  it('warns (does not fail) on missing stock number, services, panel count', () => {
    const r = validateRows(rows([`${V1},,,,,,dent,`, `${V2},B1,,,,,,`]), { now: NOW });
    expect(r.every((x) => x.ok)).toBe(true);
    expect(r[0]!.warnings.join(' ')).toMatch(/stock number/);
    expect(r[0]!.warnings.join(' ')).toMatch(/panel count/);
    expect(r[1]!.warnings.join(' ')).toMatch(/No services/);
  });
  it('strips control characters and clamps notes', () => {
    const r = validateRows(rows([`${V1},A1,,,,,,"bad\u0007${'x'.repeat(600)}"`]), { now: NOW });
    expect(r[0]!.value!.notes!.length).toBe(BULK_LIMITS.maxNotes);
    expect(r[0]!.value!.notes).not.toContain('\u0007');
  });
});

describe('service parsing and rates', () => {
  it('maps aliases, de-duplicates, reports unknown words', () => {
    expect(parseServiceList('dent; Interior | pdr, hail')).toEqual({ ids: ['pdr_panel', 'interior_reset', 'hail_panel'], unknown: [] });
    expect(parseServiceList('dent;wax')).toEqual({ ids: ['pdr_panel'], unknown: ['wax'] });
    expect(parseServiceList('')).toEqual({ ids: [], unknown: [] });
  });
  it('rates: config placeholders are null, so there is no suggested price', () => {
    expect(resolveRate('pdr_panel')).toBeNull();
    expect(suggestPrice([{ id: 'pdr_panel', panels: 2 }])).toBeNull();
  });
  it('rates: owner override wins; per-panel needs a panel count; sum is exact', () => {
    const o = { pdr_panel: 0.1, interior_reset: 0.2 };
    expect(suggestPrice([{ id: 'pdr_panel', panels: 3 }, { id: 'interior_reset' }], o)).toBe(0.5); // 30 + 20 cents, no float drift
    expect(suggestPrice([{ id: 'pdr_panel' }], o)).toBeNull();
    expect(suggestPrice([{ id: 'pdr_panel', panels: 1 }, { id: 'gloss_shield' }], o)).toBeNull(); // one unknown rate blocks it
    expect(resolveRate('pdr_panel', { pdr_panel: -5 })).toBeNull();
  });
});
