// Invoice math + line items. Pure; amounts are whole dollars with cents (rounded to 2dp). Prices never originate here:
// service lines are seeded from config/pricing.ts via computePrice; techs/owners may adjust amounts (logged).
import { addonDefs, serviceById } from '@/config/booking';
import { addonPrices } from '@/config/pricing';
import type { BookingRow, Invoice, Payment } from '@/lib/db';
import { computePrice } from '@/lib/pricing';
import { round2 } from './format';

export type LineKind = 'service' | 'addon' | 'travel' | 'discount' | 'credit' | 'custom';
export type LineItem = { id: string; label: string; amount: number; qty: number; kind: LineKind; serviceId?: string; addonId?: string };

export const lineTotal = (l: Pick<LineItem, 'amount' | 'qty'>): number => round2(l.amount * (l.qty || 1));
export const subtotalOf = (lines: LineItem[]): number => round2(lines.reduce((s, l) => s + lineTotal(l), 0));

export function parseLines(raw: unknown): LineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): LineItem[] => {
    const x = r as Partial<LineItem>;
    if (typeof x?.id !== 'string' || typeof x.label !== 'string' || typeof x.amount !== 'number' || !Number.isFinite(x.amount)) return [];
    return [{ id: x.id, label: x.label.slice(0, 120), amount: round2(x.amount), qty: Number.isFinite(x.qty) && x.qty! > 0 ? Number(x.qty) : 1, kind: x.kind ?? 'custom', serviceId: x.serviceId, addonId: x.addonId }];
  });
}

export type InvoiceMath = { subtotal: number; depositApplied: number; total: number; paid: number; balance: number };

/**
 * subtotal = sum of lines (discounts/credits are negative lines, so subtotal is the net job value).
 * depositApplied = deposit actually paid, capped at the subtotal. total = amount due after the deposit.
 * paid = succeeded balance payments minus refunds on those; balance = what is still owed.
 */
export function computeInvoice(lines: LineItem[], depositPaid: number, payments: Pick<Payment, 'kind' | 'amount' | 'status'>[] = []): InvoiceMath {
  const subtotal = subtotalOf(lines);
  const depositApplied = round2(Math.max(0, Math.min(depositPaid, Math.max(subtotal, 0))));
  const total = round2(subtotal - depositApplied);
  const paid = round2(payments.filter((p) => p.status === 'succeeded' && p.kind === 'balance').reduce((s, p) => s + p.amount, 0)
    - payments.filter((p) => p.status === 'succeeded' && p.kind === 'refund').reduce((s, p) => s + Math.abs(p.amount), 0));
  return { subtotal, depositApplied, total, paid, balance: round2(total - paid) };
}

export const depositPaidOf = (b: Pick<BookingRow, 'deposit_status' | 'deposit_amount'>): number => (b.deposit_status === 'paid' ? b.deposit_amount : 0);

/** Starting lines for a job: priced services at the LOW end (fixed-price detailing; dent range needs a human), add-ons, travel. */
export function seedLines(b: Pick<BookingRow, 'services' | 'addons' | 'size_class' | 'travel_fee' | 'price_low' | 'price_high'>): LineItem[] {
  const priced = computePrice({ services: b.services, sizeClass: b.size_class ?? 'sedan', addons: b.addons, dentQuote: b.price_low != null && b.price_high != null && b.services.some((s) => serviceById(s)?.dent) ? dentPartOf(b) : null, travelFee: b.travel_fee });
  const lines: LineItem[] = [];
  if (priced.ok) {
    for (const l of priced.lines) {
      const isAddon = addonDefs.some((a) => a.id === l.id);
      lines.push({ id: crypto.randomUUID(), label: l.label, amount: l.low, qty: 1, kind: isAddon ? 'addon' : 'service', ...(isAddon ? { addonId: l.id } : { serviceId: l.id.split('+')[0] }) });
    }
  }
  if (b.travel_fee > 0) lines.push({ id: crypto.randomUUID(), label: 'Travel', amount: b.travel_fee, qty: 1, kind: 'travel' });
  return lines;
}

/** The dent portion of a booking's stored range = stored total minus non-dent lines and travel. */
function dentPartOf(b: Pick<BookingRow, 'services' | 'addons' | 'size_class' | 'travel_fee' | 'price_low' | 'price_high'>): { low: number; high: number } | null {
  const nonDent = computePrice({ services: b.services.filter((s) => !serviceById(s)?.dent), sizeClass: b.size_class ?? 'sedan', addons: b.addons, travelFee: b.travel_fee });
  if (!nonDent.ok || nonDent.totalLow === null || b.price_low == null || b.price_high == null) return null;
  const low = Math.max(0, b.price_low - nonDent.totalLow);
  const high = Math.max(low, b.price_high - (nonDent.totalHigh ?? nonDent.totalLow));
  return low > 0 || high > 0 ? { low, high } : null;
}

/** Add-on catalog for the upsell picker: label + price from config only. */
export const addonCatalog = () => addonDefs.map((a) => ({ id: a.id, label: a.label, price: addonPrices[a.id], blurb: a.blurb }));

export const invoiceStatusFor = (inv: Pick<Invoice, 'status'>, m: InvoiceMath): Invoice['status'] =>
  inv.status === 'void' ? 'void' : m.balance <= 0 && m.subtotal > 0 ? 'paid' : inv.status === 'paid' ? 'sent' : inv.status;
