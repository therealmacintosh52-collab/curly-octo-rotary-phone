"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOwner, requireOwnerAdmin } from "@/lib/auth";
import { errorMessage } from "@/lib/utils";
import type { ActionResult } from "@/app/(app)/jobs/actions";
import type { PriceModifier, Resource, RetailSettings } from "@/lib/db/types";

const optionalText = (max: number) => z.string().trim().max(max).transform((s) => s || null);
const timeOrNull = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional();

function revalidate() {
  revalidatePath("/settings/retail");
  revalidatePath("/settings/booking");
  revalidatePath("/jobs/new");
  revalidatePath("/retail");
}

// --- Catalog (owner) ----------------------------------------------------------

const retailServiceSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(80),
  description: optionalText(200),
  benefit_text: optionalText(300),
  duration_minutes: z.number().int().min(5).max(1440),
  retail: z.boolean(),
  dealer: z.boolean(),
  taxable: z.boolean(),
  placeholder: z.boolean(),
  required_resource_kinds: z.array(z.enum(["bay", "lift", "tech"])).max(3),
  required_skill: optionalText(40),
  start_window_from: timeOrNull,
  start_window_to: timeOrNull,
  active: z.boolean(),
  sort_order: z.number().int().min(0).max(9999),
  /** Size prices, owner only; a missing size keeps its current value, null clears it. */
  prices: z.record(z.enum(["compact", "sedan", "suv_truck", "xl"]), z.number().min(0).nullable()).optional(),
});
export type RetailServiceInput = z.input<typeof retailServiceSchema>;

/** Create or edit a service on the shop menu (and its size prices). Owner only: prices are money. */
export async function saveRetailServiceAction(input: RetailServiceInput): Promise<ActionResult<string>> {
  const session = await requireOwner();
  const parsed = retailServiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, prices, ...data } = parsed.data;
  if ((data.start_window_from === null) !== (data.start_window_to === null) && (data.start_window_from !== undefined || data.start_window_to !== undefined)) {
    return { ok: false, error: "Set both ends of the start window, or neither" };
  }
  if (!data.retail && !data.dealer) return { ok: false, error: "Put the service on at least one menu" };
  const supabase = await createClient();
  let serviceId = id;
  if (serviceId) {
    const { error } = await supabase.from("services").update(data).eq("id", serviceId);
    if (error) return { ok: false, error: errorMessage(error).includes("services_company_id_name_key") ? "A service with that name already exists" : errorMessage(error) };
  } else {
    const sedan = prices?.sedan ?? 0;
    const { data: row, error } = await supabase
      .from("services")
      .insert({ ...data, category: "retail", default_price: sedan, company_id: session.company.id })
      .select("id")
      .single();
    if (error) return { ok: false, error: errorMessage(error).includes("services_company_id_name_key") ? "A service with that name already exists" : errorMessage(error) };
    serviceId = row.id;
  }
  const savedId: string = serviceId;
  if (prices) {
    for (const [size, price] of Object.entries(prices)) {
      const r = await setSizePriceAction(savedId, size as "compact" | "sedan" | "suv_truck" | "xl", price ?? null, false);
      if (!r.ok) return r;
    }
  }
  revalidate();
  return { ok: true, data: savedId };
}

/** Set (or clear with null) the retail price of a service for one size class. Owner only. */
export async function setSizePriceAction(serviceId: string, size: "compact" | "sedan" | "suv_truck" | "xl", price: number | null, doRevalidate = true): Promise<ActionResult> {
  const session = await requireOwner();
  if (price !== null && !(price >= 0)) return { ok: false, error: "Price must be zero or more" };
  const supabase = await createClient();
  if (price === null) {
    const { error } = await supabase.from("service_prices_by_size").delete().eq("service_id", serviceId).eq("size_class", size);
    if (error) return { ok: false, error: errorMessage(error) };
  } else {
    const { error } = await supabase.from("service_prices_by_size").upsert({ company_id: session.company.id, service_id: serviceId, size_class: size, price }, { onConflict: "service_id,size_class" });
    if (error) return { ok: false, error: errorMessage(error) };
    // The sedan price doubles as the service's default (used when no vehicle size is known); a confirmed price is no longer a placeholder.
    if (size === "sedan") await supabase.from("services").update({ default_price: price, placeholder: false }).eq("id", serviceId);
  }
  if (doRevalidate) revalidate();
  return { ok: true, data: undefined };
}

/** Put an existing service on the shop menu, or take it off (keeps the dealer side as is). Owner only. */
export async function setServiceMenusAction(serviceId: string, menus: { retail: boolean; dealer: boolean }): Promise<ActionResult> {
  await requireOwner();
  if (!menus.retail && !menus.dealer) return { ok: false, error: "Put the service on at least one menu" };
  const supabase = await createClient();
  const { error } = await supabase.from("services").update(menus).eq("id", serviceId);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidate();
  return { ok: true, data: undefined };
}

const modifierSchema = z.object({
  id: z.uuid().optional(),
  code: z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/, "Code: lowercase letters, digits and underscores"),
  label: z.string().trim().min(1).max(60),
  description: optionalText(200),
  kind: z.enum(["percent", "flat"]),
  amount: z.number().min(0).max(100000),
  active: z.boolean(),
  sort_order: z.number().int().min(0).max(9999),
});
export type ModifierInput = z.input<typeof modifierSchema>;

export async function saveModifierAction(input: ModifierInput): Promise<ActionResult<PriceModifier>> {
  const session = await requireOwner();
  const parsed = modifierSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, ...data } = parsed.data;
  const supabase = await createClient();
  const q = id ? supabase.from("price_modifiers").update(data).eq("id", id).select("*").single() : supabase.from("price_modifiers").insert({ ...data, company_id: session.company.id }).select("*").single();
  const { data: row, error } = await q;
  if (error) return { ok: false, error: errorMessage(error).includes("price_modifiers_company_id_code_key") ? "A modifier with that code already exists" : errorMessage(error) };
  revalidate();
  return { ok: true, data: row };
}

// --- Booking policy, hours, resources (owner/admin) ----------------------------

const settingsSchema = z.object({
  deposit_kind: z.enum(["percent", "flat", "none"]),
  deposit_value: z.number().min(0).max(100000),
  deposit_refundable: z.boolean(),
  hold_minutes: z.number().int().min(5).max(1440),
  cancel_hours: z.number().int().min(0).max(720),
  slot_step_minutes: z.union([z.literal(15), z.literal(30), z.literal(60)]),
  lead_time_hours: z.number().int().min(0).max(336),
  max_days_ahead: z.number().int().min(1).max(365),
  reminder_hours: z.array(z.number().int().min(1).max(720)).max(5),
  online_booking_enabled: z.boolean(),
  estimate_valid_days: z.number().int().min(1).max(365),
  tax_all_lines: z.boolean(),
  signature_required_estimate: z.boolean(),
  signature_required_receipt: z.boolean(),
  policy_text: optionalText(2000),
});
export type RetailSettingsInput = z.input<typeof settingsSchema>;

export async function saveRetailSettingsAction(input: RetailSettingsInput): Promise<ActionResult<RetailSettings>> {
  const session = await requireOwnerAdmin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (parsed.data.deposit_kind === "percent" && parsed.data.deposit_value > 100) return { ok: false, error: "A percent deposit cannot exceed 100" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("retail_settings").upsert({ ...parsed.data, company_id: session.company.id }, { onConflict: "company_id" }).select("*").single();
  if (error) return { ok: false, error: errorMessage(error) };
  revalidate();
  return { ok: true, data };
}

const templatesSchema = z.record(z.string().regex(/^[a-z_]+$/), z.object({ subject: z.string().trim().max(200), body: z.string().trim().max(4000) }));

export async function saveTemplatesAction(templates: Record<string, { subject: string; body: string }>): Promise<ActionResult> {
  const session = await requireOwnerAdmin();
  const parsed = templatesSchema.safeParse(templates);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { error } = await supabase.from("retail_settings").upsert({ company_id: session.company.id, email_templates: parsed.data }, { onConflict: "company_id" });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidate();
  return { ok: true, data: undefined };
}

const resourceSchema = z.object({
  id: z.uuid().optional(),
  kind: z.enum(["bay", "lift", "tech"]),
  name: z.string().trim().min(1).max(60),
  profile_id: z.uuid().nullable().optional(),
  skills: z.array(z.string().trim().min(1).max(40)).max(20),
  active: z.boolean(),
  sort_order: z.number().int().min(0).max(9999),
});
export type ResourceInput = z.input<typeof resourceSchema>;

export async function saveResourceAction(input: ResourceInput): Promise<ActionResult<Resource>> {
  const session = await requireOwnerAdmin();
  const parsed = resourceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, ...data } = parsed.data;
  const row = { ...data, profile_id: data.kind === "tech" ? (data.profile_id ?? null) : null };
  const supabase = await createClient();
  const q = id ? supabase.from("resources").update(row).eq("id", id).select("*").single() : supabase.from("resources").insert({ ...row, company_id: session.company.id }).select("*").single();
  const { data: saved, error } = await q;
  if (error) return { ok: false, error: errorMessage(error) };
  revalidate();
  return { ok: true, data: saved };
}

const hoursSchema = z.array(z.object({ dow: z.number().int().min(0).max(6), opens: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/), closes: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/), closed: z.boolean() })).length(7);

export async function saveHoursAction(hours: { dow: number; opens: string; closes: string; closed: boolean }[]): Promise<ActionResult> {
  const session = await requireOwnerAdmin();
  const parsed = hoursSchema.safeParse(hours);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  for (const h of parsed.data) if (!h.closed && h.opens >= h.closes) return { ok: false, error: "Opening time must be before closing time" };
  const supabase = await createClient();
  const { error } = await supabase.from("business_hours").upsert(parsed.data.map((h) => ({ ...h, company_id: session.company.id })), { onConflict: "company_id,dow" });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidate();
  return { ok: true, data: undefined };
}

export async function addBlackoutAction(day: string, reason: string | null): Promise<ActionResult> {
  const session = await requireOwnerAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: "Pick a date" };
  const supabase = await createClient();
  const { error } = await supabase.from("blackout_days").upsert({ company_id: session.company.id, day, reason: reason?.trim() || null }, { onConflict: "company_id,day" });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidate();
  return { ok: true, data: undefined };
}

export async function removeBlackoutAction(id: string): Promise<ActionResult> {
  await requireOwnerAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("blackout_days").delete().eq("id", id);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidate();
  return { ok: true, data: undefined };
}

export async function addTimeOffAction(resourceId: string, startsAt: string, endsAt: string, reason: string | null): Promise<ActionResult> {
  const session = await requireOwnerAdmin();
  const a = new Date(startsAt);
  const b = new Date(endsAt);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) return { ok: false, error: "The end must come after the start" };
  const supabase = await createClient();
  const { error } = await supabase.from("time_off").insert({ company_id: session.company.id, resource_id: resourceId, starts_at: a.toISOString(), ends_at: b.toISOString(), reason: reason?.trim() || null });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidate();
  return { ok: true, data: undefined };
}

export async function removeTimeOffAction(id: string): Promise<ActionResult> {
  await requireOwnerAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("time_off").delete().eq("id", id);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidate();
  return { ok: true, data: undefined };
}
