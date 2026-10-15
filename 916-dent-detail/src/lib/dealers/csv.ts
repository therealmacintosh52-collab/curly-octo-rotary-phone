// CSV for bulk vehicle submission: RFC 4180 parser (quotes, embedded commas/newlines, BOM, CRLF), delimiter sniffing
// (comma / tab / semicolon: pasted Excel cells are tab separated), header aliases, and per-row validation. Pure.
import { parseServiceList, getDealerService, type ServiceRequest } from './catalog';
import { decodeVinOffline, normalizeVin, validateVin } from './vin';

export const BULK_LIMITS = { maxRows: 200, maxBytes: 250_000, maxNotes: 500, maxStock: 40 } as const;

export const TEMPLATE_HEADERS = ['vin', 'stock_number', 'year', 'make', 'model', 'color', 'panels', 'services', 'notes'] as const;

export type ParsedCsv = { headers: string[]; rows: { line: number; cells: Record<string, string> }[]; delimiter: string; errors: string[] };

function sniffDelimiter(text: string): string {
  const first = text.split(/\r?\n/, 1)[0] ?? '';
  let inQ = false; const n: Record<string, number> = { ',': 0, '\t': 0, ';': 0 };
  for (const ch of first) { if (ch === '"') inQ = !inQ; else if (!inQ && ch in n) n[ch]!++; }
  return (['\t', ';', ','] as const).reduce((best, d) => (n[d]! > n[best]! ? d : best), ',' as string);
}

/** Split text into records of fields. Tracks the starting line of each record. */
export function parseDelimited(text: string, delimiter: string): { line: number; fields: string[] }[] {
  const out: { line: number; fields: string[] }[] = [];
  let field = ''; let fields: string[] = []; let inQ = false; let line = 1; let recLine = 1; let any = false;
  const push = () => { fields.push(field); field = ''; };
  const end = () => { push(); if (fields.some((f) => f.trim() !== '') || fields.length > 1) out.push({ line: recLine, fields }); fields = []; any = false; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else { if (c === '\n') line++; field += c; }
      continue;
    }
    if (c === '"' && field === '') { inQ = true; any = true; }
    else if (c === delimiter) { push(); any = true; }
    else if (c === '\r') { /* handled with \n */ }
    else if (c === '\n') { end(); line++; recLine = line; }
    else { field += c; any = true; }
  }
  if (any || field !== '' || fields.length) end();
  return out;
}

const ALIASES: Record<string, string[]> = {
  vin: ['vin', 'vin#', 'vin number', 'vin no', 'vehicle identification number'],
  stock_number: ['stock', 'stock#', 'stock no', 'stock no.', 'stock number', 'stock_number', 'stk', 'stk#', 'stocknumber'],
  year: ['year', 'yr', 'model year'],
  make: ['make'],
  model: ['model'],
  color: ['color', 'colour'],
  panels: ['panels', 'panel', 'panel count', '#panels', 'panels requested', 'dents'],
  services: ['services', 'service', 'work', 'work requested', 'services requested', 'panels/services'],
  notes: ['notes', 'note', 'comments', 'comment', 'damage', 'description'],
  lot_address: ['lot', 'lot address', 'location', 'address'],
};
const headerKey = (h: string): string | null => {
  const k = h.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s*#\s*/g, '#').replace(/\s+/g, ' ');
  for (const [key, list] of Object.entries(ALIASES)) if (list.includes(k)) return key;
  return null;
};

export function parseCsv(textIn: string): ParsedCsv {
  const errors: string[] = [];
  const text = String(textIn ?? '').replace(/^﻿/, '');
  if (text.length > BULK_LIMITS.maxBytes) return { headers: [], rows: [], delimiter: ',', errors: [`That file is too large (limit ${Math.round(BULK_LIMITS.maxBytes / 1000)} KB). Split it into batches.`] };
  const delimiter = sniffDelimiter(text);
  const recs = parseDelimited(text, delimiter);
  if (!recs.length) return { headers: [], rows: [], delimiter, errors: ['Nothing to import: paste or upload rows with a VIN column.'] };
  const keys = recs[0]!.fields.map(headerKey);
  if (!keys.includes('vin')) return { headers: [], rows: [], delimiter, errors: ['The first row must be a header row with a "vin" column. Download the template to see the columns.'] };
  const dup = keys.find((k, i) => k && keys.indexOf(k) !== i);
  if (dup) errors.push(`Column "${dup}" appears twice; the first one is used.`);
  const rows = recs.slice(1).map((r) => {
    const cells: Record<string, string> = {};
    keys.forEach((k, i) => { if (k && cells[k] === undefined) cells[k] = (r.fields[i] ?? '').trim(); });
    return { line: r.line, cells };
  });
  if (rows.length > BULK_LIMITS.maxRows) errors.push(`Too many rows (${rows.length}); the limit is ${BULK_LIMITS.maxRows} per batch.`);
  return { headers: keys.filter((k): k is string => !!k), rows: rows.slice(0, BULK_LIMITS.maxRows), delimiter, errors };
}

export function templateCsv(): string {
  const rows = [
    TEMPLATE_HEADERS.join(','),
    // Sample VINs are published check-digit-valid examples; remove these rows before uploading.
    '1HGCM82633A004352,A1042,2003,Honda,Accord,Silver,2,dent;interior,Door ding left rear. Remove this sample row',
    '1M8GDM9AXKP042788,A1043,,,,White,,interior,Interior only. Remove this sample row',
  ];
  return rows.join('\r\n') + '\r\n';
}

export type VehicleInput = {
  vin: string; stock_number: string | null; year: number | null; make: string | null; model: string | null; color: string | null;
  panels: number | null; services: ServiceRequest[]; notes: string | null; lot_address: string | null; decoded: 'csv' | 'offline' | 'none';
};
export type RowResult = { line: number; ok: boolean; errors: string[]; warnings: string[]; value?: VehicleInput; vin?: string };

const clean = (s: string | undefined, max: number): string | null => {
  const v = String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  return v || null;
};

/** existingOpen: VIN -> stock# / status text for submissions still open on the dealer's account. */
export function validateRows(parsed: ParsedCsv['rows'], opts: { existingOpen?: Map<string, string>; now?: Date } = {}): RowResult[] {
  const now = opts.now ?? new Date();
  const seen = new Map<string, number>();
  return parsed.map(({ line, cells }): RowResult => {
    const errors: string[] = []; const warnings: string[] = [];
    const vc = validateVin(cells.vin ?? '');
    const vin = vc.vin;
    if (!vc.ok) errors.push(vc.message);
    else {
      const first = seen.get(vin);
      if (first !== undefined) errors.push(`Duplicate VIN: already on line ${first} of this file.`);
      else seen.set(vin, line);
      const open = opts.existingOpen?.get(vin);
      if (open) errors.push(`Already submitted and still open (${open}).`);
    }
    const stock = clean(cells.stock_number, BULK_LIMITS.maxStock);
    if (!stock) warnings.push('No stock number: add one so you can find this car later.');

    let year: number | null = null; let decoded: VehicleInput['decoded'] = 'none';
    if (cells.year) {
      const y = Number(cells.year);
      if (!Number.isInteger(y) || y < 1981 || y > now.getFullYear() + 1) errors.push(`Year "${cells.year}" is not a model year between 1981 and ${now.getFullYear() + 1}.`);
      else { year = y; decoded = 'csv'; }
    }
    let make = clean(cells.make, 40); let model = clean(cells.model, 60);
    if (make || model) decoded = 'csv';
    if (vc.ok && (!year || !make)) {
      const d = decodeVinOffline(vin, now);
      if (!year && d.year) { year = d.year; decoded = decoded === 'csv' ? 'csv' : 'offline'; }
      if (!make && d.make) { make = d.make; decoded = decoded === 'csv' ? 'csv' : 'offline'; }
    }

    let panels: number | null = null;
    if (cells.panels) {
      const p = Number(cells.panels);
      if (!Number.isInteger(p) || p < 0 || p > 30) errors.push(`Panels "${cells.panels}" must be a whole number from 0 to 30.`);
      else panels = p;
    }
    const sl = parseServiceList(cells.services ?? '');
    if (sl.unknown.length) errors.push(`Unknown service: ${sl.unknown.join(', ')}. Use: dent, hail, interior, deep clean, swirl, gloss, headlights.`);
    const services: ServiceRequest[] = sl.ids.map((id) => ({ id, ...(getDealerService(id)?.unit === 'panel' ? { panels } : {}) }));
    if (!sl.ids.length && !sl.unknown.length) warnings.push('No services listed: we will inspect and propose work.');
    if (panels && !sl.ids.some((id) => getDealerService(id)?.unit === 'panel')) warnings.push('Panels given but no dent or hail service listed.');
    if (sl.ids.some((id) => getDealerService(id)?.unit === 'panel') && !panels) warnings.push('No panel count: the tech will count panels on arrival.');

    const notes = clean(cells.notes, BULK_LIMITS.maxNotes);
    const ok = errors.length === 0;
    return {
      line, ok, errors, warnings, vin,
      ...(ok ? { value: { vin, stock_number: stock, year, make, model, color: clean(cells.color, 30), panels, services, notes, lot_address: clean(cells.lot_address, 160), decoded } } : {}),
    };
  });
}

export { normalizeVin };
