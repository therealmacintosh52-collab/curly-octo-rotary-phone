import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { toPickedCustomer, type CustomerPick, type PickedCustomer } from "@/components/retail/customer-picker";

type RC = { id: string; display_name: string | null; phone: string | null; email: string | null; vehicles: { id: string; year: number | null; make: string | null; model: string | null; color: string | null; vin: string | null; plate: string | null; size_class: PickedCustomer["vehicles"][number]["size_class"]; archived_at: string | null }[] };
const SELECT = "id, display_name, phone, email, vehicles(id, year, make, model, color, vin, plate, size_class, archived_at)";
const live = (c: RC) => toPickedCustomer(c, c.vehicles.filter((v) => !v.archived_at));

/**
 * Recent customers with their cars for the picker, plus the customer and
 * vehicle a page handed over in the query string (`?customer=&vehicle=`).
 */
export async function loadPickerCustomers(supabase: SupabaseClient<Database>, sp: Record<string, string | string[] | undefined>): Promise<{ recent: PickedCustomer[]; initialPick: CustomerPick | null }> {
  const { data: rows } = await supabase.from("customers").select(SELECT).is("archived_at", null).is("merged_into_id", null).order("updated_at", { ascending: false }).limit(20);
  const recent = ((rows ?? []) as unknown as RC[]).map(live);
  const wantCustomer = typeof sp.customer === "string" ? sp.customer : null;
  let initialPick: CustomerPick | null = null;
  if (wantCustomer) {
    const found = recent.find((c) => c.id === wantCustomer);
    const { data: one } = found ? { data: null } : await supabase.from("customers").select(SELECT).eq("id", wantCustomer).maybeSingle();
    const picked = found ?? (one ? live(one as unknown as RC) : null);
    if (picked) {
      const wantVehicle = typeof sp.vehicle === "string" ? sp.vehicle : null;
      initialPick = { customer: picked, vehicleId: wantVehicle && picked.vehicles.some((v) => v.id === wantVehicle) ? wantVehicle : picked.vehicles.length === 1 ? picked.vehicles[0].id : null };
    }
  }
  return { recent, initialPick };
}
