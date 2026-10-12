import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { EstimateDocData } from "@/components/estimates/estimate-doc";

type Row = Database["public"]["Tables"]["estimates"]["Row"] & {
  estimate_lines: Database["public"]["Tables"]["estimate_lines"]["Row"][];
  shops: Database["public"]["Tables"]["shops"]["Row"] | null;
  vehicles: Database["public"]["Tables"]["vehicles"]["Row"] | null;
};

export const ESTIMATE_SELECT = "*, estimate_lines(*), shops(*), vehicles(*)";

export function toEstimateDoc(e: Row): EstimateDocData {
  return {
    estimate_number: e.estimate_number,
    status: e.status,
    created_at: e.created_at,
    valid_until: e.valid_until,
    customer_name: e.customer_name,
    customer_email: e.customer_email,
    customer_phone: e.customer_phone,
    labor_rate: Number(e.labor_rate),
    tax_rate: Number(e.tax_rate),
    tax_parts: e.tax_parts,
    tax_labor: e.tax_labor,
    notes: e.notes,
    shop: e.shops ? { name: e.shops.name, phone: e.shops.phone, email: e.shops.email, address: e.shops.address } : null,
    vehicle: e.vehicles ? { year: e.vehicles.year, make: e.vehicles.make, model: e.vehicles.model, engine: e.vehicles.engine, vin: e.vehicles.vin, plate: e.vehicles.plate, mileage: e.vehicles.mileage } : null,
    lines: [...e.estimate_lines]
      .sort((a, b) => a.sort - b.sort)
      .map((l) => ({ kind: l.kind, description: l.description, part_number: l.part_number, quantity: Number(l.quantity), unit_price: Number(l.unit_price), hours: l.hours == null ? null : Number(l.hours), taxable: l.taxable })),
  };
}

export async function getEstimate(supabase: SupabaseClient<Database>, id: string) {
  const { data } = await supabase.from("estimates").select(ESTIMATE_SELECT).eq("id", id).maybeSingle();
  return data as Row | null;
}
