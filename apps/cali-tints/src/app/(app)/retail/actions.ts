"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Customer, CustomerListRow, Vehicle } from "@/lib/db/types";
import { customerSchema, vehicleSchema, type CustomerInput, type VehicleInput } from "@/lib/retail/schema";
import { errorMessage } from "@/lib/utils";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function revalidateRetail(customerId?: string | null, vehicleId?: string | null) {
  revalidatePath("/retail");
  revalidatePath("/retail/customers");
  if (customerId) revalidatePath(`/retail/customers/${customerId}`);
  if (vehicleId) revalidatePath(`/retail/vehicles/${vehicleId}`);
}

/** Create or edit a customer (save_customer RPC validates and normalises). */
export async function saveCustomerAction(input: CustomerInput): Promise<ActionResult<Customer>> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_customer", { p: parsed.data });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateRetail(data.id);
  return { ok: true, data };
}

/** Same phone or email as an existing customer: shown as a warning while typing. */
export async function findDuplicateCustomersAction(phone: string | null, email: string | null, exclude?: string | null): Promise<ActionResult<Pick<Customer, "id" | "display_name" | "phone" | "email">[]>> {
  if (!phone && !email) return { ok: true, data: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_duplicate_customers", { p_phone: phone, p_email: email, p_exclude: exclude ?? null });
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true, data: (data ?? []).map((c) => ({ id: c.id, display_name: c.display_name, phone: c.phone, email: c.email })) };
}

/** Search customers by name, phone, email, plate or VIN (the picker on New job). */
export async function searchCustomersAction(q: string): Promise<ActionResult<CustomerListRow[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("customers_filtered", { p_q: q.trim() || null, p_archived: false, p_limit: 12, p_offset: 0 });
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true, data: data?.rows ?? [] };
}

export async function archiveCustomerAction(id: string, on: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session.isAdmin) return { ok: false, error: "Admin only" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_customer", { p_id: id, p_on: on });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateRetail(id);
  return { ok: true, data: undefined };
}

export async function mergeCustomersAction(keepId: string, mergeId: string): Promise<ActionResult<Customer>> {
  const session = await getSession();
  if (!session.isAdmin) return { ok: false, error: "Admin only" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("merge_customers", { p_keep: keepId, p_merge: mergeId });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateRetail(keepId);
  revalidatePath(`/retail/customers/${mergeId}`);
  revalidatePath("/jobs");
  return { ok: true, data };
}

/** Create or edit a vehicle; `odometer` logs a reading at the same time. */
export async function saveVehicleAction(input: VehicleInput): Promise<ActionResult<Vehicle>> {
  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_vehicle", { p: parsed.data });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateRetail(data.customer_id, data.id);
  return { ok: true, data };
}

export async function addOdometerAction(vehicleId: string, reading: number, readAt?: string | null): Promise<ActionResult> {
  if (!Number.isInteger(reading) || reading <= 0) return { ok: false, error: "Enter the mileage as a whole number" };
  const supabase = await createClient();
  const { data: vehicle } = await supabase.from("vehicles").select("customer_id").eq("id", vehicleId).maybeSingle();
  const { error } = await supabase.rpc("add_odometer", { p_vehicle: vehicleId, p_reading: reading, p_read_at: readAt ?? null });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateRetail(vehicle?.customer_id ?? null, vehicleId);
  return { ok: true, data: undefined };
}

/** A queued text was sent from the phone (or is not wanted). Any member. */
export async function textQueueDoneAction(id: string, dismiss = false): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("text_queue_done", { p_id: id, p_dismiss: dismiss });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/retail");
  return { ok: true, data: undefined };
}

/** The customer left a review (or did not): no more review requests. Any member. */
export async function markReviewedAction(customerId: string, on = true): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_reviewed", { p_customer: customerId, p_on: on });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/retail/customers/${customerId}`);
  return { ok: true, data: undefined };
}
