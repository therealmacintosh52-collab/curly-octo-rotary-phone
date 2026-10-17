"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { InspectionState, VisitInspection } from "@/lib/db/types";
import { errorMessage } from "@/lib/utils";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const id = z.uuid();
const refresh = (estimateId: string) => revalidatePath(`/retail/estimates/${estimateId}`);

/** A checklist on a visit, from a template or blank (0073). */
export async function addInspectionAction(estimateId: string, input: { template?: string | null; name?: string | null; job?: string | null }): Promise<Result<VisitInspection>> {
  if (!id.safeParse(estimateId).success) return { ok: false, error: "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_inspection", { p_estimate: estimateId, p_template: input.template ?? null, p_name: input.name ?? null, p_job: input.job ?? null });
  if (error || !data) return { ok: false, error: errorMessage(error) };
  refresh(estimateId);
  return { ok: true, data };
}

/** Tick, flag or clear one row. Any member who may write on the visit. */
export async function setInspectionItemAction(estimateId: string, itemId: string, state: InspectionState, note?: string | null): Promise<Result<VisitInspection>> {
  if (!id.safeParse(itemId).success || !["pending", "ok", "attention", "na"].includes(state)) return { ok: false, error: "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_inspection_item", { p_item: itemId, p_state: state, p_note: note ?? null });
  if (error || !data) return { ok: false, error: errorMessage(error) };
  refresh(estimateId);
  return { ok: true, data };
}

export async function addInspectionItemAction(estimateId: string, inspectionId: string, label: string): Promise<Result<VisitInspection>> {
  if (!id.safeParse(inspectionId).success) return { ok: false, error: "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_inspection_item", { p_inspection: inspectionId, p_label: label });
  if (error || !data) return { ok: false, error: errorMessage(error) };
  refresh(estimateId);
  return { ok: true, data };
}

export async function deleteInspectionItemAction(estimateId: string, itemId: string): Promise<Result<VisitInspection>> {
  if (!id.safeParse(itemId).success) return { ok: false, error: "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_inspection_item", { p_item: itemId });
  if (error || !data) return { ok: false, error: errorMessage(error) };
  refresh(estimateId);
  return { ok: true, data };
}

export async function deleteInspectionAction(estimateId: string, inspectionId: string): Promise<Result> {
  if (!id.safeParse(inspectionId).success) return { ok: false, error: "Invalid input" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_inspection", { p_id: inspectionId });
  if (error) return { ok: false, error: errorMessage(error) };
  refresh(estimateId);
  return { ok: true, data: undefined };
}

export async function setInspectionCustomerAction(estimateId: string, inspectionId: string, show: boolean): Promise<Result> {
  if (!id.safeParse(inspectionId).success) return { ok: false, error: "Invalid input" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_inspection_customer", { p_id: inspectionId, p_show: show });
  if (error) return { ok: false, error: errorMessage(error) };
  refresh(estimateId);
  return { ok: true, data: undefined };
}

/** A red item becomes a finding on the visit (photos, price, send to the customer follow from there). */
export async function inspectionItemToFindingAction(estimateId: string, itemId: string): Promise<Result> {
  if (!id.safeParse(itemId).success) return { ok: false, error: "Invalid input" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("inspection_item_to_finding", { p_item: itemId });
  if (error) return { ok: false, error: errorMessage(error) };
  refresh(estimateId);
  return { ok: true, data: undefined };
}
