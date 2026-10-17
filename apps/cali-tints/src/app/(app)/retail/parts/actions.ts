"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { InventoryItem, InventoryItemInput, PartOrder, StockMovement } from "@/lib/db/types";
import { errorMessage } from "@/lib/utils";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const id = z.uuid();
const money = z.number().min(0).max(1_000_000);
const refresh = () => {
  revalidatePath("/retail/parts");
  revalidatePath("/retail");
};

const itemSchema = z.object({
  id: id.optional(),
  part_number: z.string().trim().min(1, "Give the part a number").max(60),
  name: z.string().trim().min(1, "Give the part a name").max(120),
  vendor_id: id.nullable().optional(),
  brand: z.string().trim().max(60).nullable().optional(),
  bin: z.string().trim().max(30).nullable().optional(),
  cost: money.nullable().optional(),
  list_price: money.nullable().optional(),
  reorder_at: z.number().min(0).max(100000).nullable().optional(),
  taxable: z.boolean().nullable().optional(),
  active: z.boolean().optional(),
  qty_on_hand: z.number().min(-100000).max(100000).optional(),
});

export async function saveInventoryItemAction(input: InventoryItemInput): Promise<Result<InventoryItem>> {
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_inventory_item", { p: parsed.data as InventoryItemInput });
  if (error || !data) return { ok: false, error: errorMessage(error) };
  refresh();
  return { ok: true, data };
}

export async function adjustStockAction(itemId: string, delta: number, note: string): Promise<Result<InventoryItem>> {
  if (!id.safeParse(itemId).success || !Number.isFinite(delta)) return { ok: false, error: "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("adjust_stock", { p_item: itemId, p_delta: delta, p_note: note.slice(0, 200) || null });
  if (error || !data) return { ok: false, error: errorMessage(error) };
  refresh();
  return { ok: true, data };
}

export async function inventoryHistoryAction(itemId: string): Promise<Result<StockMovement[]>> {
  if (!id.safeParse(itemId).success) return { ok: false, error: "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("inventory_item_history", { p_item: itemId });
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true, data: data ?? [] };
}

/** The estimate's part picker: stocked parts by name, number, brand or bin. */
export async function searchInventoryAction(q: string): Promise<Result<InventoryItem[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("inventory_list", { p_q: q.slice(0, 60) || null, p_low: false, p_limit: 12 });
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true, data: data ?? [] };
}

export async function saveVendorAction(input: { id?: string; name: string; phone?: string | null; email?: string | null; account_no?: string | null; notes?: string | null; active?: boolean }): Promise<Result<string>> {
  const parsed = z.object({ id: id.optional(), name: z.string().trim().min(1, "Give the vendor a name").max(80), phone: z.string().trim().max(40).nullable().optional(), email: z.string().trim().max(120).nullable().optional(), account_no: z.string().trim().max(40).nullable().optional(), notes: z.string().trim().max(500).nullable().optional(), active: z.boolean().optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_vendor", { p: parsed.data });
  if (error || !data) return { ok: false, error: errorMessage(error) };
  refresh();
  return { ok: true, data };
}

const orderSchema = z.object({
  vendor_id: id.nullable().optional(),
  estimate_id: id.nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
  lines: z.array(z.object({ item_id: id.nullable().optional(), part_number: z.string().trim().max(60).nullable().optional(), name: z.string().trim().min(1, "Every line needs a name").max(120), qty: z.number().positive("Every line needs a quantity").max(10000), cost: money.nullable().optional() })).min(1, "Add at least one part to the order").max(60),
});
export async function createPartOrderAction(input: z.input<typeof orderSchema>): Promise<Result<PartOrder>> {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_part_order", { p: parsed.data });
  if (error || !data) return { ok: false, error: errorMessage(error) };
  refresh();
  return { ok: true, data };
}

/** "Order these parts" on a visit: a draft order from its part lines that are not in stock. */
export async function orderPartsForEstimateAction(estimateId: string): Promise<Result<PartOrder>> {
  if (!id.safeParse(estimateId).success) return { ok: false, error: "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("order_parts_for_estimate", { p_estimate: estimateId });
  if (error || !data) return { ok: false, error: errorMessage(error) };
  refresh();
  revalidatePath(`/retail/estimates/${estimateId}`);
  return { ok: true, data };
}

export async function markPartOrderOrderedAction(orderId: string, vendorId: string | null): Promise<Result<PartOrder>> {
  if (!id.safeParse(orderId).success) return { ok: false, error: "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_part_order_ordered", { p_id: orderId, p_vendor: vendorId });
  if (error || !data) return { ok: false, error: errorMessage(error) };
  refresh();
  if (data.estimate_id) revalidatePath(`/retail/estimates/${data.estimate_id}`);
  return { ok: true, data };
}

export async function receivePartOrderAction(orderId: string, lines: { line_id: string; qty: number }[]): Promise<Result<PartOrder>> {
  if (!id.safeParse(orderId).success || lines.length === 0) return { ok: false, error: "Type what arrived" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("receive_part_order", { p_id: orderId, p_lines: lines });
  if (error || !data) return { ok: false, error: errorMessage(error) };
  refresh();
  if (data.estimate_id) revalidatePath(`/retail/estimates/${data.estimate_id}`);
  return { ok: true, data };
}

export async function cancelPartOrderAction(orderId: string): Promise<Result> {
  if (!id.safeParse(orderId).success) return { ok: false, error: "Invalid input" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_part_order", { p_id: orderId });
  if (error) return { ok: false, error: errorMessage(error) };
  refresh();
  return { ok: true, data: undefined };
}

export async function partOrderDetailAction(orderId: string): Promise<Result<PartOrder>> {
  if (!id.safeParse(orderId).success) return { ok: false, error: "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("part_order_detail", { p_id: orderId });
  if (error || !data) return { ok: false, error: errorMessage(error) };
  return { ok: true, data };
}
