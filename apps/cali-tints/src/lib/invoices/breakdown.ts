import type { BalanceBreakdown } from "@/components/invoices/invoice-actions";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateOnly } from "@/lib/dates";

/** Group invoice lines by car and list payments, for the "See what makes up the balance" dialog. */
export function balanceBreakdown(b: { invoice: { subtotal: number; tax: number; tax_rate: number; total: number }; items: { tag_number: string; year: number | null; make: string | null; model: string | null; performed_at: string; service_name: string; price: number }[]; payments: { amount: number; paid_at: string; method: string; reference: string | null; source?: string | null; note?: string | null }[] }): BalanceBreakdown {
  const cars = new Map<string, BalanceBreakdown["cars"][number]>();
  for (const it of b.items) {
    const key = `${it.tag_number}|${it.performed_at.slice(0, 10)}`;
    const car = cars.get(key) ?? { tag: it.tag_number, vehicle: [it.year, it.make, it.model].filter(Boolean).join(" ") || "Vehicle", date: formatDate(it.performed_at, "MMM d, yyyy"), services: [] };
    car.services.push({ name: it.service_name, amount: Number(it.price) });
    cars.set(key, car);
  }
  const methods: Record<string, string> = { card: "Card", cash: "Cash", check: "Check", ach: "ACH / wire", other: "Other" };
  return {
    cars: [...cars.values()],
    subtotal: Number(b.invoice.subtotal),
    tax: Number(b.invoice.tax),
    taxRate: Number(b.invoice.tax_rate),
    total: Number(b.invoice.total),
    payments: b.payments.map((p) => ({
      label: formatMoney(p.amount),
      sub: [formatDateOnly(p.paid_at), p.source && p.source !== "manual" ? "Clover" : methods[p.method] ?? p.method, p.reference ? `#${p.reference}` : null, p.note].filter(Boolean).join(" · "),
      amount: Number(p.amount),
    })),
  };
}
