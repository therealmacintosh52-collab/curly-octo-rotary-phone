"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerAdmin } from "@/lib/auth";
import { errorMessage } from "@/lib/utils";
import type { ActionResult } from "@/app/(app)/jobs/actions";
import { getMerchant } from "@/lib/clover/client";
import { cloverContext } from "@/lib/clover/invoices";
import { disconnectClover, markConnection } from "@/lib/clover/connection";

const optionalText = (max: number) => z.string().trim().max(max).transform((s) => s || null);

// --- Company ------------------------------------------------------------------

const companySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().or(z.literal("")).transform((s) => s || null),
  phone: optionalText(40),
  address_line1: optionalText(120),
  address_line2: optionalText(120),
  city: optionalText(80),
  state: optionalText(40),
  postal_code: optionalText(20),
  ein: optionalText(40),
  payment_terms: z.string().trim().min(1).max(80),
  tax_rate: z.number().min(0).max(0.5),
  invoice_prefix: z.string().trim().max(12),
  reminder_days: z.number().int().min(1).max(365),
  timezone: z.string().trim().min(1).max(64),
  /** Email the dealership a receipt the moment a payment lands on an invoice. */
  auto_receipt: z.boolean(),
});
export type CompanyInput = z.input<typeof companySchema>;

export async function updateCompanyAction(input: CompanyInput): Promise<ActionResult> {
  const session = await requireOwnerAdmin();
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { error } = await supabase.from("companies").update(parsed.data).eq("id", session.company.id);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function uploadLogoAction(formData: FormData): Promise<ActionResult> {
  const session = await requireOwnerAdmin();
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image" };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "Logo must be under 2 MB" };
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${session.company.id}/logo-${Date.now()}.${ext}`;
  const supabase = await createClient();
  const { error: upErr } = await supabase.storage.from("logos").upload(path, file, { contentType: file.type || undefined, upsert: true });
  if (upErr) return { ok: false, error: upErr.message };
  const { error } = await supabase.from("companies").update({ logo_path: path }).eq("id", session.company.id);
  if (error) return { ok: false, error: errorMessage(error) };
  if (session.company.logo_path && session.company.logo_path !== path) {
    await supabase.storage.from("logos").remove([session.company.logo_path]);
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function removeLogoAction(): Promise<ActionResult> {
  const session = await requireOwnerAdmin();
  const supabase = await createClient();
  if (session.company.logo_path) await supabase.storage.from("logos").remove([session.company.logo_path]);
  const { error } = await supabase.from("companies").update({ logo_path: null }).eq("id", session.company.id);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

// --- Dealerships ------------------------------------------------------------

const dealershipSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(120),
  address_line1: optionalText(120),
  address_line2: optionalText(120),
  city: optionalText(80),
  state: optionalText(40),
  postal_code: optionalText(20),
  contact_name: optionalText(80),
  contact_phone: optionalText(40),
  ap_contact_name: optionalText(80),
  ap_emails: z.array(z.string().trim().email()).max(10),
  submission_method: z.enum(["email", "portal", "paper"]),
  invoice_mode: z.enum(["batch", "per_job"]),
  payment_terms: optionalText(80),
  tax_rate: z.number().min(0).max(0.5).nullable(),
  active: z.boolean(),
});
export type DealershipInput = z.input<typeof dealershipSchema>;

export async function saveDealershipAction(input: DealershipInput): Promise<ActionResult<string>> {
  const session = await requireOwnerAdmin();
  const parsed = dealershipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, ...data } = parsed.data;
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("dealerships").update(data).eq("id", id);
    if (error) return { ok: false, error: errorMessage(error) };
    revalidatePath("/settings/dealerships");
    return { ok: true, data: id };
  }
  const { data: row, error } = await supabase
    .from("dealerships")
    .insert({ ...data, company_id: session.company.id })
    .select("id")
    .single();
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/settings/dealerships");
  return { ok: true, data: row.id };
}

// --- Services & prices --------------------------------------------------------

const serviceSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(80),
  description: optionalText(200),
  category: z.enum(["new", "used", "service", "addon"]),
  default_price: z.number().min(0),
  price_min: z.number().min(0).nullable(),
  price_max: z.number().min(0).nullable(),
  sort_order: z.number().int().min(0).max(9999),
  active: z.boolean(),
});
export type ServiceInput = z.input<typeof serviceSchema>;

export async function saveServiceAction(input: ServiceInput): Promise<ActionResult<string>> {
  const session = await requireOwnerAdmin();
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, ...data } = parsed.data;
  if ((data.price_min === null) !== (data.price_max === null)) return { ok: false, error: "Set both ends of the price range, or neither" };
  if (data.price_min !== null && data.price_max !== null && data.price_min > data.price_max) return { ok: false, error: "Range minimum is above the maximum" };
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("services").update(data).eq("id", id);
    if (error) return { ok: false, error: errorMessage(error).includes("services_company_id_name_key") ? "A service with that name already exists" : errorMessage(error) };
    revalidatePath("/settings/services");
    return { ok: true, data: id };
  }
  const { data: row, error } = await supabase
    .from("services")
    .insert({ ...data, company_id: session.company.id })
    .select("id")
    .single();
  if (error) return { ok: false, error: errorMessage(error).includes("services_company_id_name_key") ? "A service with that name already exists" : errorMessage(error) };
  revalidatePath("/settings/services");
  return { ok: true, data: row.id };
}

/** Set (or clear with null) a dealership-specific price for one service. */
export async function setDealershipPriceAction(dealershipId: string, serviceId: string, price: number | null): Promise<ActionResult> {
  const session = await requireOwnerAdmin();
  if (price !== null && !(price >= 0)) return { ok: false, error: "Price must be zero or more" };
  const supabase = await createClient();
  if (price === null) {
    const { error } = await supabase.from("dealership_service_prices").delete().eq("dealership_id", dealershipId).eq("service_id", serviceId);
    if (error) return { ok: false, error: errorMessage(error) };
  } else {
    const { error } = await supabase
      .from("dealership_service_prices")
      .upsert({ company_id: session.company.id, dealership_id: dealershipId, service_id: serviceId, price }, { onConflict: "dealership_id,service_id" });
    if (error) return { ok: false, error: errorMessage(error) };
  }
  revalidatePath("/settings/services");
  return { ok: true, data: undefined };
}

// --- Users --------------------------------------------------------------------

const inviteSchema = z.object({
  email: z.string().trim().email(),
  full_name: z.string().trim().min(1).max(80),
  role: z.enum(["admin", "manager", "detailer"]),
  /** "invite" sends a Supabase invite email; "password" creates the account with a password the owner hands over. */
  mode: z.enum(["invite", "password"]),
  password: z.string().min(8).max(72).optional(),
});
export type InviteInput = z.input<typeof inviteSchema>;

export async function createUserAction(input: InviteInput): Promise<ActionResult<{ userId: string }>> {
  const session = await requireOwnerAdmin();
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const p = parsed.data;
  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  const metadata = { company_id: session.company.id, role: p.role, full_name: p.full_name };

  if (p.mode === "password") {
    if (!p.password) return { ok: false, error: "Password is required (min 8 characters)" };
    const { data, error } = await admin.auth.admin.createUser({ email: p.email, password: p.password, email_confirm: true, user_metadata: metadata });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/settings/users");
    return { ok: true, data: { userId: data.user.id } };
  }

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/callback?next=/auth/reset`;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(p.email, { data: metadata, redirectTo });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/users");
  return { ok: true, data: { userId: data.user.id } };
}

export async function updateUserAction(input: { id: string; full_name: string; role: "owner" | "admin" | "manager" | "detailer"; active: boolean }): Promise<ActionResult> {
  const session = await requireOwnerAdmin();
  const parsed = z
    .object({ id: z.uuid(), full_name: z.string().trim().min(1).max(80), role: z.enum(["owner", "admin", "manager", "detailer"]), active: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const p = parsed.data;
  if (p.id === session.userId && (p.role === "detailer" || p.role === "manager" || !p.active)) return { ok: false, error: "You cannot demote or deactivate yourself" };
  if (p.role === "owner" && session.profile.role !== "owner") return { ok: false, error: "Only an owner can grant the owner role" };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: p.full_name, role: p.role, active: p.active }).eq("id", p.id);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/settings/users");
  return { ok: true, data: undefined };
}

/** Admin sets a new password for a user who cannot use email (shown once to the owner). */
export async function resetUserPasswordAction(userId: string, password: string): Promise<ActionResult> {
  const session = await requireOwnerAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(userId) || password.length < 8) return { ok: false, error: "Password must be at least 8 characters" };
  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("id, company_id").eq("id", userId).maybeSingle();
  if (!target || target.company_id !== session.company.id) return { ok: false, error: "User not found" };
  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

// --- Clover -------------------------------------------------------------------

const cloverSettingsSchema = z.object({
  clover_enabled: z.boolean(),
  clover_env: z.enum(["sandbox", "production"]),
  clover_merchant_id: z.string().trim().max(40).transform((s) => s || null),
  clover_push_orders: z.boolean(),
  clover_hosted_checkout: z.boolean(),
  clover_device_id: z.string().trim().max(40).transform((s) => s || null),
  clover_pos_id: z.string().trim().min(1).max(40).default("Cali Tints app"),
});
export type CloverSettingsInput = z.input<typeof cloverSettingsSchema>;

export async function updateCloverSettingsAction(input: CloverSettingsInput): Promise<ActionResult> {
  const session = await requireOwnerAdmin();
  const parsed = cloverSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (parsed.data.clover_enabled && !parsed.data.clover_merchant_id) return { ok: false, error: "Enter the Clover merchant ID before enabling" };
  const supabase = await createClient();
  const { error } = await supabase.from("companies").update(parsed.data).eq("id", session.company.id);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** Calls GET /v3/merchants/{id} with the stored API token; proves the token, env and merchant id agree. */
export async function testCloverConnectionAction(input: { clover_env: "sandbox" | "production"; clover_merchant_id: string }): Promise<ActionResult<{ name: string }>> {
  const session = await requireOwnerAdmin();
  const parsed = z.object({ clover_env: z.enum(["sandbox", "production"]), clover_merchant_id: z.string().trim().min(1).max(40) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter the merchant ID" };
  try {
    const m = await getMerchant({ env: parsed.data.clover_env, merchantId: parsed.data.clover_merchant_id });
    // Remember that the token, environment and merchant id agree (setup checklist).
    const supabase = await createClient();
    await supabase.from("companies").update({ clover_verified_at: new Date().toISOString() }).eq("id", session.company.id);
    revalidatePath("/", "layout");
    return { ok: true, data: { name: m.name } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Ping Clover with whatever credentials the company has (sign-in or manual tokens) and record the result. */
export async function checkCloverConnectionAction(): Promise<ActionResult<{ name: string; ms: number }>> {
  const session = await requireOwnerAdmin();
  const ctx = cloverContext(session.company);
  if (!ctx) return { ok: false, error: "Clover is not enabled yet" };
  const t0 = Date.now();
  try {
    const m = await getMerchant(ctx);
    const supabase = await createClient();
    await supabase.from("companies").update({ clover_verified_at: new Date().toISOString() }).eq("id", session.company.id);
    await markConnection(session.company.id, true).catch(() => {});
    revalidatePath("/", "layout");
    return { ok: true, data: { name: m.name, ms: Date.now() - t0 } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Forget the Clover sign-in (tokens are deleted). Manual tokens in the environment, if any, still apply. */
export async function disconnectCloverAction(): Promise<ActionResult> {
  const session = await requireOwnerAdmin();
  try {
    await disconnectClover(session.company.id);
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
