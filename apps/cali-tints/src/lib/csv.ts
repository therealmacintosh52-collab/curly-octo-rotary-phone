/**
 * Minimal RFC 4180 CSV writer. Header order is fixed by the caller so the
 * dealership's accounting import (or a future DMS integration) can rely on it.
 */

export type CsvValue = string | number | boolean | null | undefined;

export function csvEscape(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  // Neutralise spreadsheet formula injection ("=cmd()", "+", "-", "@").
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv<T extends Record<string, CsvValue>>(rows: T[], columns: { key: keyof T & string; header: string }[]): string {
  const lines = [columns.map((c) => csvEscape(c.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => csvEscape(row[c.key])).join(","));
  }
  // CRLF line endings + trailing newline; UTF-8 BOM so Excel opens it cleanly.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
