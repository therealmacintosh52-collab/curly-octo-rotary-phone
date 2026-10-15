// CSV with spreadsheet-injection protection: a cell that starts with = + - @ tab or CR is prefixed with an apostrophe
// (OWASP CSV injection). Numbers pass through untouched so sums still work in Excel/Sheets.
export type Col<T> = { header: string; value: (row: T) => string | number | null | undefined };

export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = String(v).replace(/\r\n|\r/g, '\n');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], cols: Col<T>[]): string {
  return `${[cols.map((c) => csvCell(c.header)).join(','), ...rows.map((r) => cols.map((c) => csvCell(c.value(r))).join(','))].join('\r\n')}\r\n`;
}
