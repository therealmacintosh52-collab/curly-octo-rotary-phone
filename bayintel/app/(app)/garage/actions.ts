"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const VehicleInput = z.object({
  vin: z.string().regex(/^[A-HJ-NPR-Z0-9]{17}$/).nullable(),
  year: z.number().int().min(1949).max(2100),
  make: z.string().min(1).max(60),
  model: z.string().min(1).max(80),
  trim: z.string().max(80).nullable().optional(),
  engine: z.string().max(80).nullable().optional(),
  displacement_l: z.number().nullable().optional(),
  cylinders: z.number().int().nullable().optional(),
  fuel_type: z.string().max(60).nullable().optional(),
  drive_type: z.string().max(60).nullable().optional(),
  body_class: z.string().max(80).nullable().optional(),
  transmission: z.string().max(80).nullable().optional(),
  plant: z.string().max(120).nullable().optional(),
  specs: z.record(z.string(), z.string()).default({}),
  specs_source: z.enum(["NHTSA", "OWNER"]),
  nickname: z.string().max(60).nullable().optional(),
  plate: z.string().max(20).nullable().optional(),
  mileage: z.number().int().nullable().optional(),
});
export type VehicleInput = z.input<typeof VehicleInput>;

export async function saveVehicleAction(input: VehicleInput): Promise<{ error?: string } | undefined> {
  const parsed = VehicleInput.safeParse(input);
  if (!parsed.success) return { error: "Invalid vehicle data" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };
  const { data: profile } = await supabase.from("profiles").select("shop_id").eq("id", user.id).single();

  // Re-open an existing garage entry with the same VIN instead of duplicating it.
  if (parsed.data.vin) {
    const { data: existing } = await supabase.from("vehicles").select("id").eq("vin", parsed.data.vin).limit(1).maybeSingle();
    if (existing) redirect(`/vehicles/${existing.id}`);
  }

  const { data, error } = await supabase
    .from("vehicles")
    .insert({ ...parsed.data, owner_id: user.id, shop_id: profile?.shop_id ?? null })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/garage");
  redirect(`/vehicles/${data.id}`);
}

export async function updateVehicleAction(id: string, patch: { nickname?: string | null; plate?: string | null; mileage?: number | null; engine?: string | null; notes?: string | null }) {
  const supabase = await createClient();
  const { error } = await supabase.from("vehicles").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/vehicles/${id}`);
  revalidatePath("/garage");
}

export async function deleteVehicleAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/garage");
  redirect("/garage");
}
