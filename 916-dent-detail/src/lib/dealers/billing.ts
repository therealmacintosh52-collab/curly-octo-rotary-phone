// Statement math, billing periods and receivables aging. Money is integer cents inside, whole-dollar numbers at the
// edges (DB columns are numeric(10,2), the app convention is dollars). Pure and unit-tested.

export const toCents = (dollars: number): number => Math.round(dollars * 100);
export const fromCents = (cents: number): number => Math.round(cents) / 100;
export const money = (dollars: number): string => `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type StatementLine = {
  vehicle_id: string;
  stock_number: string | null;
  vin: string | null;
  label: string;          // "2019 Honda Accord"
  done_at: string;
  description: string;    // "Dent Removal x2 panels, Interior Reset"
  base: number;           // dollars
  addons: { id: string; label: string; amount: number }[];
  total: number;          // dollars = base + addons
};

export type PricedVehicle = {
  vehicle_id: string; stock_number: string | null; vin: string | null; label: string; done_at: string; description: string;
  price: number | null; addons: { id: string; label: string; price: number | null; status: string }[];
};

/** Build lines for priced vehicles. A vehicle with no price is held back (returned in `unpriced`) rather than billed at $0.
 *  Only APPROVED add-ons with a price are billed; unpriced approved add-ons also hold the vehicle back. */
export function buildStatement(vehicles: PricedVehicle[]): { lines: StatementLine[]; unpriced: PricedVehicle[]; totalCents: number } {
  const lines: StatementLine[] = [];
  const unpriced: PricedVehicle[] = [];
  let totalCents = 0;
  for (const v of vehicles) {
    const approved = v.addons.filter((a) => a.status === 'approved');
    if (v.price === null || approved.some((a) => a.price === null)) { unpriced.push(v); continue; }
    const addons = approved.map((a) => ({ id: a.id, label: a.label, amount: a.price as number }));
    const cents = toCents(v.price) + addons.reduce((n, a) => n + toCents(a.amount), 0);
    totalCents += cents;
    lines.push({ vehicle_id: v.vehicle_id, stock_number: v.stock_number, vin: v.vin, label: v.label, done_at: v.done_at, description: v.description, base: v.price, addons, total: fromCents(cents) });
  }
  lines.sort((a, b) => a.done_at.localeCompare(b.done_at) || (a.stock_number ?? '').localeCompare(b.stock_number ?? ''));
  return { lines, unpriced, totalCents };
}

// ---- periods (calendar months in the business time zone)
export const BUSINESS_TZ = 'America/Los_Angeles';

/** "2026-09" -> { start: "2026-09-01", end: "2026-09-30", endExclusiveUtc... } as plain dates + UTC instants of local midnight. */
export function monthPeriod(ym: string, tz = BUSINESS_TZ): { ym: string; start: string; end: string; startUtc: string; endUtc: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) throw new Error(`Bad month "${ym}" (want YYYY-MM)`);
  const y = Number(m[1]); const mo = Number(m[2]);
  if (mo < 1 || mo > 12) throw new Error(`Bad month "${ym}"`);
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
  return { ym, start: `${ym}-01`, end: `${ym}-${String(last).padStart(2, '0')}`, startUtc: localMidnightUtc(`${ym}-01`, tz), endUtc: localMidnightUtc(`${next}-01`, tz) };
}

/** UTC ISO instant of 00:00 local time on a YYYY-MM-DD date in `tz` (DST safe: searches the offset). */
export function localMidnightUtc(date: string, tz = BUSINESS_TZ): string {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  const guess = Date.UTC(y, mo - 1, d, 0, 0, 0);
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const offsetAt = (t: number) => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)) - t;
  };
  let t = guess - offsetAt(guess);
  t = guess - offsetAt(t); // second pass settles across a DST edge
  return new Date(t).toISOString();
}

/** The month before `now`, as YYYY-MM in the business time zone. */
export function previousMonth(now = new Date(), tz = BUSINESS_TZ): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit' }).formatToParts(now).map((x) => [x.type, x.value]));
  let y = Number(p.year); let m = Number(p.month) - 1;
  if (m === 0) { m = 12; y -= 1; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export const monthLabel = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

// ---- aging
export type AgingInvoice = { total: number; due_at?: string | null; status: string };
export type Aging = { current: number; d1_30: number; d31_60: number; d61_90: number; d90plus: number; total: number; overdue: number };

export function daysPastDue(dueAt: string | null | undefined, now: number): number {
  if (!dueAt) return 0;
  return Math.floor((now - Date.parse(dueAt)) / 86_400_000);
}

/** Receivables aging over unpaid invoices (sent / overdue). Paid, void and draft invoices are ignored. Buckets by days past due. */
export function aging(invoices: AgingInvoice[], now = Date.now()): Aging {
  const a = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
  for (const inv of invoices) {
    if (inv.status !== 'sent' && inv.status !== 'overdue') continue;
    const c = toCents(inv.total);
    const d = daysPastDue(inv.due_at, now);
    if (d <= 0) a.current += c; else if (d <= 30) a.d1_30 += c; else if (d <= 60) a.d31_60 += c; else if (d <= 90) a.d61_90 += c; else a.d90plus += c;
  }
  const total = a.current + a.d1_30 + a.d31_60 + a.d61_90 + a.d90plus;
  return { current: fromCents(a.current), d1_30: fromCents(a.d1_30), d31_60: fromCents(a.d31_60), d61_90: fromCents(a.d61_90), d90plus: fromCents(a.d90plus), total: fromCents(total), overdue: fromCents(total - a.current) };
}

/** Due date for an invoice issued at `issuedAt` with net `days`. Days <= 0 = due on receipt. */
export const dueDate = (issuedAt: number, days: number): string => new Date(issuedAt + Math.max(0, days) * 86_400_000).toISOString();

/** Invoice status for display: an unpaid invoice past its due date is overdue even before the cron persists it. */
export function effectiveInvoiceStatus(status: string, dueAt: string | null | undefined, now = Date.now()): string {
  return status === 'sent' && dueAt && Date.parse(dueAt) < now ? 'overdue' : status;
}
