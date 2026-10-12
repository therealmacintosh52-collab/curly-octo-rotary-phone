"use server";

import { headers } from "next/headers";
import { z } from "zod";
import type { AppointmentView, Slot } from "@/lib/db/types";
import { anonClient, isTokenShape } from "@/lib/estimates/public";
import { throttle } from "@/lib/booking/public";
import { errorMessage } from "@/lib/utils";

export type PublicResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function cancelByTokenAction(token: string, reason: string): Promise<PublicResult<AppointmentView>> {
  if (!isTokenShape(token)) return { ok: false, error: "That booking link is not valid" };
  const { data, error } = await anonClient().rpc("cancel_by_token", { p_token: token, p_reason: z.string().trim().max(300).parse(reason ?? "") || null });
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true, data };
}

/** Slots for the same services, between two shop days. */
export async function slotsByTokenAction(token: string, from: string, to: string): Promise<PublicResult<Slot[]>> {
  if (!isTokenShape(token)) return { ok: false, error: "That booking link is not valid" };
  if (!throttle(await clientIp())) return { ok: false, error: "Too many requests; try again in a minute" };
  const db = anonClient();
  const { data: a, error: e1 } = await db.rpc("appointment_by_token", { p_token: token });
  if (e1 || !a) return { ok: false, error: "That booking link is not valid" };
  const lines = a.services.filter((s) => s.service_id).map((s) => ({ service_id: s.service_id!, qty: s.qty, label: s.name, price: s.unit_price, modifiers: s.modifiers.map((m) => m.code) }));
  const { data, error } = await db.rpc("find_slots", { p_lines: lines, p_from: from, p_to: to });
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true, data: data ?? [] };
}

export async function rescheduleByTokenAction(token: string, startsAt: string): Promise<PublicResult<AppointmentView>> {
  if (!isTokenShape(token)) return { ok: false, error: "That booking link is not valid" };
  const { data, error } = await anonClient().rpc("reschedule_by_token", { p_token: token, p_starts_at: startsAt });
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true, data };
}
