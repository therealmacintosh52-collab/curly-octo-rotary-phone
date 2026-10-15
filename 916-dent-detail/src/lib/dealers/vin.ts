// VIN validation (ISO 3779 / 49 CFR 565): 17 chars, no I/O/Q, check digit in position 9. Pure; safe on client and server.
// Offline decode gives model year (and a conservative make hint). Model/trim need the NHTSA vPIC decoder (live mode only).

const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789';

export function normalizeVin(raw: string): string {
  return String(raw ?? '').replace(/[\s-]+/g, '').toUpperCase();
}

/** Expected check digit for the first 17 chars (ignores position 9's current value). null when a char is not VIN-legal. */
export function computeCheckDigit(vin: string): string | null {
  const v = normalizeVin(vin);
  if (v.length !== 17) return null;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const c = v[i]!;
    const val = /\d/.test(c) ? Number(c) : TRANSLIT[c];
    if (val === undefined) return null;
    sum += val * WEIGHTS[i]!;
  }
  const r = sum % 11;
  return r === 10 ? 'X' : String(r);
}

export type VinCheck = { ok: true; vin: string } | { ok: false; vin: string; reason: 'length' | 'chars' | 'check_digit'; message: string };

export function validateVin(raw: string): VinCheck {
  const vin = normalizeVin(raw);
  if (vin.length !== 17) return { ok: false, vin, reason: 'length', message: `A VIN is 17 characters (this one has ${vin.length}).` };
  if (/[IOQ]/.test(vin)) return { ok: false, vin, reason: 'chars', message: 'A VIN never contains the letters I, O or Q.' };
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return { ok: false, vin, reason: 'chars', message: 'A VIN uses only letters and digits.' };
  if (computeCheckDigit(vin) !== vin[8]) return { ok: false, vin, reason: 'check_digit', message: 'Check digit does not match: one character is probably mistyped.' };
  return { ok: true, vin };
}

/** Model year from position 10, disambiguated by position 7 (alpha = 2010+, digit = 1980-2009) per 49 CFR 565.15 for cars. */
export function modelYearFromVin(raw: string, now = new Date()): number | null {
  const v = normalizeVin(raw);
  if (v.length !== 17) return null;
  const idx = YEAR_CODES.indexOf(v[9]!);
  if (idx < 0) return null;
  const early = 1980 + idx;
  let year = /[A-Z]/.test(v[6]!) ? early + 30 : early;
  const max = now.getFullYear() + 1;
  while (year > max) year -= 30;
  return year >= 1981 ? year : null;
}

// Conservative hints for common World Manufacturer Identifiers. A hint only fills an empty Make; a CSV value or vPIC wins.
const WMI: Record<string, string> = {
  '1HG': 'Honda', '2HG': 'Honda', '19X': 'Honda', JHM: 'Honda', '5FN': 'Honda',
  '4T1': 'Toyota', '5TD': 'Toyota', '2T1': 'Toyota', JTD: 'Toyota', '5YF': 'Toyota',
  '1FA': 'Ford', '1FT': 'Ford', '1FM': 'Ford', '1FD': 'Ford',
  '1G1': 'Chevrolet', '1GC': 'Chevrolet', '3GN': 'Chevrolet',
  '1N4': 'Nissan', '3N1': 'Nissan', JN1: 'Nissan', '5N1': 'Nissan',
  KNA: 'Kia', KND: 'Kia', '5XY': 'Kia', KMH: 'Hyundai', '5NP': 'Hyundai',
  '1C4': 'Chrysler', '1C6': 'Ram', '1J4': 'Jeep', '1GY': 'Cadillac', '5YJ': 'Tesla',
  WBA: 'BMW', '5UX': 'BMW', WDD: 'Mercedes-Benz', WAU: 'Audi', WVW: 'Volkswagen', JF1: 'Subaru', '4S3': 'Subaru', JM1: 'Mazda',
};
export function makeHintFromVin(raw: string): string | null {
  return WMI[normalizeVin(raw).slice(0, 3)] ?? null;
}

export type VinDecode = { year: number | null; make: string | null; model: string | null; source: 'offline' | 'vpic' };

export function decodeVinOffline(raw: string, now = new Date()): VinDecode {
  return { year: modelYearFromVin(raw, now), make: makeHintFromVin(raw), model: null, source: 'offline' };
}

/** NHTSA vPIC (free US-government decoder). Network call: callers only use it in live mode. Sends the VIN, nothing else. */
export async function decodeVinVpic(raw: string, fetchFn: typeof fetch = fetch, timeoutMs = 4000): Promise<VinDecode | null> {
  const v = normalizeVin(raw);
  if (!validateVin(v).ok) return null;
  try {
    const res = await fetchFn(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${v}?format=json`, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
    if (!res.ok) return null;
    const j = (await res.json()) as { Results?: { ModelYear?: string; Make?: string; Model?: string; ErrorCode?: string }[] };
    const r = j.Results?.[0];
    if (!r) return null;
    const year = Number(r.ModelYear);
    const title = (s?: string) => (s ? s.trim().toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : null) || null;
    return { year: Number.isInteger(year) && year > 1980 ? year : null, make: title(r.Make), model: r.Model?.trim() || null, source: 'vpic' };
  } catch {
    return null;
  }
}
