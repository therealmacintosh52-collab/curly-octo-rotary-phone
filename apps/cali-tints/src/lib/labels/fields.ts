import { addMonths, format } from "date-fns";
import type { EstimateView } from "@/lib/db/types";

/** What a key tag says. Staff show as initials only; the customer as first name and last initial. */
export type KeyTagFields = { number: string; kind: "Estimate" | "Work Order" | "Invoice"; car: string; color: string | null; plate: string | null; vin6: string | null; customer: string; label: string | null; dueOut: string | null; advisor: string | null; mileage: number | null };

export function keyTagFields(e: EstimateView): KeyTagFields {
  const ro = e.job?.ro_number ?? e.ro_number ?? null;
  const kind = e.job?.invoice_number ? "Invoice" : ro ? "Work Order" : "Estimate";
  const number = e.job?.invoice_number ?? ro ?? e.display_number;
  const first = (e.customer.first_name ?? "").trim();
  const full = (e.customer.display_name ?? first).trim();
  const last = full.split(/\s+/).slice(1).join(" ");
  const car = [e.vehicle?.year, e.vehicle?.make, e.vehicle?.model].filter(Boolean).join(" ") || e.vehicle?.name || "Vehicle";
  return {
    number,
    kind,
    car,
    color: e.vehicle?.color ?? null,
    plate: e.vehicle?.plate ?? null,
    vin6: e.vehicle?.vin ? e.vehicle.vin.slice(-6).toUpperCase() : null,
    customer: last ? `${first || full.split(/\s+/)[0]} ${last[0].toUpperCase()}.` : full || "Customer",
    label: e.label ?? null,
    dueOut: e.due_out ?? null,
    advisor: e.advisor ?? null,
    mileage: e.odometer ?? null,
  };
}

export type OilStickerOptions = { intervalMiles: number; intervalMonths: number; oil: string | null; today?: Date };
export type OilStickerFields = { date: string; mileage: number | null; nextMileage: number | null; nextDate: string; oil: string | null; car: string; plate: string | null };

/** "Next service": the mileage in plus the interval, and the date plus the months, whichever comes first. */
export function oilStickerFields(e: EstimateView, o: OilStickerOptions): OilStickerFields {
  const today = o.today ?? new Date();
  const miles = e.job?.odometer ?? e.odometer ?? null;
  const interval = Math.min(Math.max(Math.round(o.intervalMiles) || 5000, 500), 50000);
  const months = Math.min(Math.max(Math.round(o.intervalMonths) || 6, 1), 24);
  return {
    date: format(today, "MM/dd/yy"),
    mileage: miles,
    nextMileage: miles != null ? miles + interval : null,
    nextDate: format(addMonths(today, months), "MM/dd/yy"),
    oil: o.oil?.trim() ? o.oil.trim().slice(0, 24) : null,
    car: [e.vehicle?.year, e.vehicle?.make, e.vehicle?.model].filter(Boolean).join(" ") || e.vehicle?.name || "",
    plate: e.vehicle?.plate ?? null,
  };
}

/** Query string → options (defaults 5,000 miles / 6 months). */
export function oilStickerOptions(q: URLSearchParams): OilStickerOptions {
  return { intervalMiles: Number(q.get("miles")) || 5000, intervalMonths: Number(q.get("months")) || 6, oil: q.get("oil") };
}
