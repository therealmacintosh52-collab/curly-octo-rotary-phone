"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const RoInput = z.object({
  vehicle_id: z.string().uuid(),
  status: z.enum(["open", "in_progress", "completed", "invoiced"]).default("open"),
  mileage: z.coerce.number().int().min(0).max(2000000).nullable().default(null),
  customer_name: z.string().trim().max(120).nullable().default(null),
  concern: z.string().trim().min(3).max(4000),
  cause: z.string().trim().max(4000).nullable().default(null),
  correction: z.string().trim().max(6000).nullable().default(null),
  dtc_codes: z.array(z.string().regex(/^[PBCU][0-9A-F]{4}$/)).max(20).default([]),
  tests_performed: z.array(z.object({ test: z.string().max(300), result: z.string().max(500) })).max(30).default([]),
  parts: z.array(z.object({ name: z.string().min(1).max(120), part_number: z.string().max(60).nullable(), quantity: z.coerce.number().positive().max(999), unit_price: z.coerce.number().min(0).nullable() })).max(40).default([]),
  labor_hours: z.coerce.number().min(0).max(200).nullable().default(null),
  notes: z.string().trim().max(4000).nullable().default(null),
  media: z.array(z.object({ storage_path: z.string().min(1), caption: z.string().max(200).nullable().default(null) })).max(12).default([]),
});
export type RoInput = z.input<typeof RoInput>;

export async function saveRepairOrderAction(id: string | null, input: RoInput): Promise<{ error?: string } | undefined> {
  const parsed = RoInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid repair order" };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };
  const { data: profile } = await supabase.from("profiles").select("shop_id").eq("id", user.id).single();
  const { media, ...rest } = d;
  const row = { ...rest, completed_at: d.status === "completed" || d.status === "invoiced" ? new Date().toISOString() : null };
  let roId = id;
  if (roId) {
    const { data: prev } = await supabase.from("repair_orders").select("completed_at").eq("id", roId).single();
    const { error } = await supabase.from("repair_orders").update({ ...row, completed_at: row.completed_at ? (prev?.completed_at ?? row.completed_at) : null }).eq("id", roId);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase
      .from("repair_orders")
      .insert({ ...row, author_id: user.id, shop_id: profile?.shop_id ?? null })
      .select("id")
      .single();
    if (error) return { error: error.message };
    roId = data.id;
  }
  const { data: existing } = await supabase.from("repair_order_media").select("id, storage_path").eq("repair_order_id", roId);
  const keep = new Set(media.map((m) => m.storage_path));
  const have = new Set((existing ?? []).map((m) => m.storage_path));
  const removed = (existing ?? []).filter((m) => !keep.has(m.storage_path)).map((m) => m.id);
  const added = media.filter((m) => !have.has(m.storage_path));
  if (removed.length) await supabase.from("repair_order_media").delete().in("id", removed);
  if (added.length) await supabase.from("repair_order_media").insert(added.map((m) => ({ repair_order_id: roId!, uploaded_by: user.id, ...m })));
  if (d.mileage) await supabase.from("vehicles").update({ mileage: d.mileage }).eq("id", d.vehicle_id);
  revalidatePath("/repair-orders");
  revalidatePath(`/repair-orders/${roId}`);
  revalidatePath(`/vehicles/${d.vehicle_id}`);
  redirect(`/repair-orders/${roId}`);
}

export async function setRoStatusAction(id: string, status: "open" | "in_progress" | "completed" | "invoiced") {
  const supabase = await createClient();
  const patch: { status: typeof status; completed_at?: string | null } = { status };
  if (status === "completed") patch.completed_at = new Date().toISOString();
  if (status === "open" || status === "in_progress") patch.completed_at = null;
  const { error } = await supabase.from("repair_orders").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/repair-orders/${id}`);
  revalidatePath("/repair-orders");
}

export async function deleteRepairOrderAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("repair_orders").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/repair-orders");
  redirect("/repair-orders");
}
