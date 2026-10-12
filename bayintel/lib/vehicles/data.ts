import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getProviders } from "@/lib/providers";
import type { Complaint, Recall } from "@/lib/providers/types";
import type { Database } from "@/lib/database.types";

export type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];

export async function getVehicle(id: string): Promise<VehicleRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("vehicles").select("*").eq("id", id).maybeSingle();
  return data;
}

export interface NhtsaBundle {
  recalls: Recall[];
  complaints: Complaint[];
  errors: { recalls?: string; complaints?: string };
}

/** Recalls + complaints for a vehicle key, each failing independently. */
export async function getNhtsaBundle(key: { year: number; make: string; model: string }): Promise<NhtsaBundle> {
  const p = getProviders().vehicle;
  const [r, c] = await Promise.allSettled([p.getRecalls(key), p.getComplaints(key)]);
  return {
    recalls: r.status === "fulfilled" ? r.value : [],
    complaints: c.status === "fulfilled" ? c.value : [],
    errors: {
      recalls: r.status === "rejected" ? String(r.reason?.message ?? r.reason) : undefined,
      complaints: c.status === "rejected" ? String(c.reason?.message ?? c.reason) : undefined,
    },
  };
}
