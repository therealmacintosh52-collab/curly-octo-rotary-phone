const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

export function isValidVinFormat(vin: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
}

/** North American check-digit test (position 9). Non-NA VINs can legitimately fail. */
export function vinCheckDigitOk(vin: string) {
  if (!isValidVinFormat(vin)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const ch = vin[i];
    const val = /\d/.test(ch) ? Number(ch) : TRANSLIT[ch];
    if (val === undefined) return false;
    sum += val * WEIGHTS[i];
  }
  const rem = sum % 11;
  const expected = rem === 10 ? "X" : String(rem);
  return vin[8] === expected;
}

export function vinModelYear(vin: string): number | null {
  if (!isValidVinFormat(vin)) return null;
  const code = vin[9];
  const table = "ABCDEFGHJKLMNPRSTVWXY123456789";
  const idx = table.indexOf(code);
  if (idx < 0) return null;
  // Position 7 letter => 2010+ series (2010-2039), digit => 1980-2009.
  const base = /[A-Z]/.test(vin[6]) ? 2010 : 1980;
  return base + idx;
}
