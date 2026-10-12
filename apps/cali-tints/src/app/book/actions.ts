"use server";

import { headers } from "next/headers";
import { z } from "zod";
import type { BookingLineInput, ConfirmResult, HoldResult, Slot, VehicleSize } from "@/lib/db/types";
import { anonClient, isTokenShape } from "@/lib/estimates/public";
import { throttle } from "@/lib/booking/public";
import { errorMessage } from "@/lib/utils";

export type PublicResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

const lineSchema = z.object({ service_id: z.uuid(), qty: z.number().positive().max(10).optional(), modifiers: z.array(z.string().trim().max(40)).max(10).optional() });
const sizeSchema = z.enum(["compact", "sedan", "suv_truck", "xl"]);

/** Open slots for the services picked, between two shop days (yyyy-MM-dd, at most 14 apart). */
export async function publicSlotsAction(lines: BookingLineInput[], from: string, to: string, estimateToken?: string): Promise<PublicResult<Slot[]>> {
  if (!throttle(await clientIp())) return { ok: false, error: "Too many requests; try again in a minute" };
  const parsed = z.array(lineSchema).max(20).safeParse(lines);
  if (!parsed.success) return { ok: false, error: "Pick the services first" };
  const db = anonClient();
  let p_lines: BookingLineInput[] = parsed.data;
  if (estimateToken) {
    const r = await estimateLines(estimateToken);
    if (!r) return { ok: false, error: "That estimate is not approved" };
    p_lines = r;
  }
  const { data, error } = await db.rpc("find_slots", { p_lines, p_from: from, p_to: to });
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true, data: data ?? [] };
}

/** The lines an approved estimate books (its chosen option plus the ticked add-ons), read without exposing anything else. */
async function estimateLines(token: string): Promise<BookingLineInput[] | null> {
  if (!isTokenShape(token)) return null;
  const { data: e } = await anonClient().rpc("estimate_by_token", { p_token: token });
  if (!e || e.status !== "accepted") return null;
  const chosen = e.options.find((o) => o.id === e.selected_option_id);
  const lines = [...(chosen?.lines ?? []), ...e.addons.filter((a) => a.customer_approved === true)];
  return lines.filter((l) => l.service_id).map((l) => ({ service_id: l.service_id!, qty: l.qty, label: l.name, price: l.unit_price, modifiers: l.modifiers.map((m) => m.code) }));
}

export async function publicQuoteAction(size: VehicleSize, lines: BookingLineInput[]): Promise<PublicResult<{ total: number; deposit: number; duration_minutes: number }>> {
  const parsed = z.array(lineSchema).max(20).safeParse(lines);
  if (!parsed.success || !sizeSchema.safeParse(size).success) return { ok: false, error: "Pick the services first" };
  const db = anonClient();
  const [{ data: q, error }, { data: cat }] = await Promise.all([db.rpc("public_quote", { p_size: size, p_lines: parsed.data }), db.rpc("public_catalog")]);
  if (error || !q) return { ok: false, error: error ? errorMessage(error) : "Could not price that" };
  const s = cat?.settings;
  const deposit = !s || s.deposit_kind === "none" ? 0 : s.deposit_kind === "flat" ? Math.min(Number(s.deposit_value), q.total) : Math.round(q.total * Number(s.deposit_value)) / 100;
  return { ok: true, data: { total: q.total, deposit, duration_minutes: q.duration_minutes } };
}

const holdSchema = z.object({
  size_class: sizeSchema.optional(),
  lines: z.array(lineSchema).max(20).optional(),
  starts_at: z.string().min(10),
  intake: z.record(z.string(), z.unknown()).optional(),
  estimate_token: z.string().max(80).optional(),
  customer_notes: z.string().trim().max(1000).optional(),
});
export type HoldInput = z.input<typeof holdSchema>;

/** Hold the slot for hold_minutes while the customer fills in who they are. */
export async function createHoldAction(input: HoldInput): Promise<PublicResult<HoldResult>> {
  if (!throttle(await clientIp(), 20)) return { ok: false, error: "Too many requests; try again in a minute" };
  const parsed = holdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { data, error } = await anonClient().rpc("create_hold", { p: parsed.data });
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true, data };
}

const confirmSchema = z.object({
  contact: z
    .object({
      first_name: z.string().trim().min(1, "Your first name").max(60),
      last_name: z.string().trim().max(60).optional(),
      phone: z.string().trim().min(7, "A phone number we can text").max(30),
      email: z.string().trim().max(120).nullable().optional(),
      sms_opt_in: z.boolean().optional(),
      marketing_opt_in: z.boolean().optional(),
    })
    .optional(),
  vehicle: z.object({ year: z.number().int().min(1900).max(2100).nullable().optional(), make: z.string().trim().max(60).nullable().optional(), model: z.string().trim().max(60).nullable().optional(), color: z.string().trim().max(40).nullable().optional(), vin: z.string().trim().max(17).nullable().optional() }).optional(),
  pay_choice: z.enum(["deposit", "at_shop"]).optional(),
  customer_notes: z.string().trim().max(1000).optional(),
});
export type ConfirmInput = z.input<typeof confirmSchema>;

/** The hold becomes a Lead (the shop confirms it, or the deposit will). Emails the customer when possible. */
export async function confirmHoldAction(token: string, input: ConfirmInput): Promise<PublicResult<ConfirmResult>> {
  if (!isTokenShape(token)) return { ok: false, error: "That booking link is not valid" };
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const email = parsed.data.contact?.email?.trim() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "That email does not look right" };
  const p = { ...parsed.data, contact: parsed.data.contact ? { ...parsed.data.contact, email } : undefined };
  const { data, error } = await anonClient().rpc("confirm_hold", { p_token: token, p });
  if (error) return { ok: false, error: errorMessage(error) };
  // "We got your booking request" and the owner's heads-up go out through the automation rules.
  return { ok: true, data };
}
