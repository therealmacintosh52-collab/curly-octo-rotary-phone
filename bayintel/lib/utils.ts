import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function titleCase(s: string | null | undefined) {
  if (!s) return "";
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w.toUpperCase()))
    .join(" ");
}

export function normalizeVin(v: string) {
  return v.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
}

export function normalizeDtc(code: string) {
  return code.toUpperCase().replace(/[^PBCU0-9A-F]/g, "");
}

export function parseDtcList(input: string): string[] {
  const seen = new Set<string>();
  for (const raw of input.split(/[\s,;]+/)) {
    const c = normalizeDtc(raw);
    if (/^[PBCU][0-9A-F]{4}$/.test(c)) seen.add(c);
  }
  return [...seen];
}
