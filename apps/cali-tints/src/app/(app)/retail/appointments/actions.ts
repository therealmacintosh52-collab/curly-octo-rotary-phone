"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus, AppointmentView, BookPayload, RetailPaymentMethod, Slot } from "@/lib/db/types";
import { createDepositLink } from "@/lib/clover/deposit";
import { depositsOnline } from "@/lib/clover/env";
import { appUrl, sendRetailEmail } from "@/lib/retail/email";
import { whenIn } from "@/lib/retail/slots";
import { formatAddress } from "@/lib/address";
import { errorMessage } from "@/lib/utils";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const lineSchema = z.object({ service_id: z.uuid(), qty: z.number().positive().max(99).optional(), label: z.string().trim().max(120).nullable().optional(), price: z.number().min(0).max(100000).nullable().optional(), modifiers: z.array(z.string().trim().max(40)).max(10).optional() });
const bookSchema = z.object({
  customer_id: z.uuid().optional(),
  vehicle_id: z.uuid().nullable().optional(),
  estimate_id: z.uuid().optional(),
  lines: z.array(lineSchema).max(30).optional(),
  starts_at: z.string().min(10),
  notes: z.string().trim().max(2000).nullable().optional(),
  customer_notes: z.string().trim().max(1000).nullable().optional(),
  size_class: z.enum(["compact", "sedan", "suv_truck", "xl"]).optional(),
});

function revalidate(id?: string) {
  revalidatePath("/retail");
  revalidatePath("/retail/calendar");
  if (id) revalidatePath(`/retail/appointments/${id}`);
}

/** Open slots for a set of lines between two shop days (yyyy-MM-dd). The engine is the same one the public page uses. */
export async function findSlotsAction(lines: BookPayload["lines"], from: string, to: string): Promise<ActionResult<Slot[]>> {
  await getSession();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_slots", { p_lines: lines ?? [], p_from: from, p_to: to });
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true, data: data ?? [] };
}

export async function bookAppointmentAction(input: BookPayload): Promise<ActionResult<AppointmentView>> {
  const session = await getSession();
  if (!session.isAdmin) return { ok: false, error: "Only the owner, an admin or a manager books appointments" };
  const parsed = bookSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_appointment", { p: parsed.data });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidate(data.id);
  await notifyBooked(data, session.company.id, session.company.name, session.company.email);
  return { ok: true, data };
}

export async function setAppointmentStatusAction(id: string, status: AppointmentStatus, reason?: string): Promise<ActionResult<AppointmentView>> {
  const session = await getSession();
  if (!session.isAdmin) return { ok: false, error: "Only the owner, an admin or a manager changes appointments" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_appointment_status", { p_id: id, p_status: status, p_reason: reason?.trim() || null });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidate(id);
  if (data.job_id) revalidatePath("/jobs");
  if (status === "booked") await notifyBooked(data, session.company.id, session.company.name, session.company.email);
  if (status === "cancelled") await notifyCancelled(data, session.company.id, session.company.name, session.company.email);
  return { ok: true, data };
}

export async function rescheduleAppointmentAction(id: string, startsAt: string): Promise<ActionResult<AppointmentView>> {
  const session = await getSession();
  if (!session.isAdmin) return { ok: false, error: "Only the owner, an admin or a manager moves appointments" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reschedule_appointment", { p_id: id, p_starts_at: startsAt });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidate(id);
  await notifyBooked(data, session.company.id, session.company.name, session.company.email);
  return { ok: true, data };
}

async function templates(companyId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("retail_settings").select("email_templates").eq("company_id", companyId).maybeSingle();
  return data?.email_templates ?? null;
}

/** "You are booked" to the customer, when they have an email and email is configured; silent otherwise. */
async function notifyBooked(a: AppointmentView, companyId: string, companyName: string, replyTo: string | null) {
  if (!a.customer?.email) return;
  // Staff views carry no token: the manage link is fetched through the gated RPC.
  const supabase = await createClient();
  const { data: token } = await supabase.rpc("appointment_link", { p_id: a.id });
  const base = appUrl() ?? "";
  await sendRetailEmail({
    to: a.customer?.email,
    key: "booking_confirmed",
    templates: await templates(companyId),
    vars: { first_name: a.customer?.first_name || "there", vehicle: a.vehicle?.name ?? "your car", starts_at: whenIn(a.starts_at, a.company.timezone), address: formatAddress(a.company).join(", "), manage_url: token ? `${base}/a/${token}` : base, company: companyName },
    companyName,
    replyTo,
    refId: a.id,
  });
}

async function notifyCancelled(a: AppointmentView, companyId: string, companyName: string, replyTo: string | null) {
  const base = appUrl() ?? "";
  await sendRetailEmail({
    to: a.customer?.email,
    key: "cancelled",
    templates: await templates(companyId),
    vars: { first_name: a.customer?.first_name || "there", starts_at: whenIn(a.starts_at, a.company.timezone), book_url: `${base}/book`, company: companyName },
    companyName,
    replyTo,
    refId: a.id,
  });
}

/** A deposit taken at drop-off (cash, check, on the Flex), or an online payment the owner matches by hand. */
export async function recordDepositAtShopAction(id: string, method: RetailPaymentMethod, reference: string, amount?: number | null): Promise<ActionResult<AppointmentView>> {
  const session = await getSession();
  if (!session.isAdmin) return { ok: false, error: "Only the owner, an admin or a manager records a deposit" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_deposit_at_shop", { p_appointment: id, p_method: method, p_reference: reference.trim() || null, p_amount: amount && amount > 0 ? Math.round(amount * 100) / 100 : null });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidate(id);
  if (data.status === "booked") await notifyBooked(data, session.company.id, session.company.name, session.company.email);
  return { ok: true, data };
}

/** Owner: record a refund on the ledger (the money moves in Clover or the till). */
export async function refundPaymentAction(paymentId: string, amount: number, note: string, appointmentId?: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session.canMoney) return { ok: false, error: "Only the owner records a refund" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("refund_payment", { p_id: paymentId, p_amount: Math.round(amount * 100) / 100, p_note: note.trim() || null });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidate(appointmentId);
  return { ok: true, data: undefined };
}

/** Staff: a Clover deposit link to text the customer (when online deposits are on). */
export async function depositLinkAction(id: string): Promise<ActionResult<{ url: string }>> {
  const session = await getSession();
  if (!session.isAdmin) return { ok: false, error: "Only the owner, an admin or a manager sends a deposit link" };
  if (!depositsOnline()) return { ok: false, error: "Online deposits are not turned on (DEPOSITS_ONLINE)" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_deposit", { p_appointment: id });
  if (error) return { ok: false, error: errorMessage(error) };
  const { data: token } = await supabase.rpc("appointment_link", { p_id: id });
  const link = await createDepositLink(data, `/a/${token ?? ""}`);
  if (!link.ok) return link;
  return { ok: true, data: { url: link.url } };
}
