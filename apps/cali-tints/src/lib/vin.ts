/**
 * VIN utilities: validation with the ISO 3779 check digit, extraction of a
 * VIN from arbitrary scanned text, and the NHTSA vPIC decode mapping.
 */

export const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;

const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/** Normalise user/scanner input: uppercase, strip spaces and the "I" prefix some door-jamb barcodes carry. */
export function normalizeVin(raw: string): string {
  let s = raw.toUpperCase().replace(/[\s-]/g, "");
  // Code 39 windshield/door labels sometimes prefix an import mark "I".
  if (s.length === 18 && s.startsWith("I")) s = s.slice(1);
  return s;
}

/** Structural validity (17 chars, allowed alphabet). */
export function isVinShape(vin: string): boolean {
  return VIN_REGEX.test(vin);
}

/** Check digit (position 9) per ISO 3779; true for all North American VINs. */
export function vinCheckDigitValid(vin: string): boolean {
  if (!isVinShape(vin)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const ch = vin[i];
    const v = /\d/.test(ch) ? Number(ch) : TRANSLIT[ch];
    if (v === undefined) return false;
    sum += v * WEIGHTS[i];
  }
  const rem = sum % 11;
  const expected = rem === 10 ? "X" : String(rem);
  return vin[8] === expected;
}

/**
 * Validity level for UI feedback. European VINs (e.g. some Mercedes built in
 * Germany) do not always carry a valid check digit, so a shape-valid VIN with
 * a bad check digit is a "warn", not a hard error.
 */
export function vinStatus(raw: string): "empty" | "invalid" | "warn" | "valid" {
  const vin = normalizeVin(raw);
  if (!vin) return "empty";
  if (!isVinShape(vin)) return "invalid";
  return vinCheckDigitValid(vin) ? "valid" : "warn";
}

/** Pull the most VIN-looking 17-char token out of scanned text (barcode payloads can carry extra data). */
export function extractVin(text: string): string | null {
  const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, " ");
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const candidates: string[] = [];
  for (const t of tokens) {
    if (t.length === 17 && isVinShape(t)) candidates.push(t);
    else if (t.length === 18 && t.startsWith("I") && isVinShape(t.slice(1))) candidates.push(t.slice(1));
    else if (t.length > 17) {
      for (let i = 0; i + 17 <= t.length; i++) {
        const sub = t.slice(i, i + 17);
        if (isVinShape(sub)) candidates.push(sub);
      }
    }
  }
  if (candidates.length === 0) return null;
  return candidates.find(vinCheckDigitValid) ?? candidates[0];
}

/** Subset of NHTSA vPIC fields we keep. */
export interface VinDecodeResult {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  bodyClass: string | null;
  /** Non-zero error code means NHTSA could not fully decode (still may return year/make). */
  errorCode: string | null;
  errorText: string | null;
}

/** Shape of one row from /api/vehicles/DecodeVinValues/{vin}?format=json */
export interface NhtsaDecodeRow {
  ModelYear?: string;
  Make?: string;
  Model?: string;
  Trim?: string;
  BodyClass?: string;
  ErrorCode?: string;
  ErrorText?: string;
  [key: string]: string | undefined;
}

const MAKE_DISPLAY: Record<string, string> = {
  "MERCEDES-BENZ": "Mercedes-Benz",
  BMW: "BMW",
  GMC: "GMC",
  "ALFA ROMEO": "Alfa Romeo",
  "LAND ROVER": "Land Rover",
  "ROLLS ROYCE": "Rolls-Royce",
  "ROLLS-ROYCE": "Rolls-Royce",
  "ASTON MARTIN": "Aston Martin",
  MINI: "MINI",
  "RAM": "Ram",
};

/** NHTSA returns makes in caps ("MERCEDES-BENZ"). Title-case for display, with brand exceptions. */
export function displayMake(make: string | null | undefined): string | null {
  if (!make) return null;
  const upper = make.trim().toUpperCase();
  if (MAKE_DISPLAY[upper]) return MAKE_DISPLAY[upper];
  return upper
    .toLowerCase()
    .split(/(\s|-)/)
    .map((part) => (part.length > 1 ? part[0].toUpperCase() + part.slice(1) : part.toUpperCase()))
    .join("");
}

/** Map an NHTSA row to our result. Returns null fields rather than throwing. */
export function mapNhtsaRow(vin: string, row: NhtsaDecodeRow | undefined): VinDecodeResult {
  const year = row?.ModelYear ? Number(row.ModelYear) : NaN;
  const nz = (s?: string) => (s && s.trim() ? s.trim() : null);
  return {
    vin,
    year: Number.isFinite(year) && year > 1900 ? year : null,
    make: displayMake(nz(row?.Make)),
    model: nz(row?.Model),
    trim: nz(row?.Trim),
    bodyClass: nz(row?.BodyClass),
    errorCode: nz(row?.ErrorCode),
    errorText: nz(row?.ErrorText),
  };
}

export const NHTSA_DECODE_URL = (vin: string) =>
  `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;
