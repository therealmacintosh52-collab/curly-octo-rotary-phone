"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/utils";

export type PinActionResult = { ok: true } | { ok: false; error: string };

/** A manager (or the owner or an admin) sets or changes their own approval PIN: 4 to 6 digits, kept only as a hash (0070). */
export async function setMyPinAction(pin: string): Promise<PinActionResult> {
  if (!/^[0-9]{4,6}$/.test(pin)) return { ok: false, error: "The PIN is 4 to 6 digits" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_pin", { p_pin: pin });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/pin");
  return { ok: true };
}

/** The owner resets someone's PIN (a forgotten one); that person sets a new one. */
export async function clearPinAction(userId: string): Promise<PinActionResult> {
  const session = await getSession();
  if (session.profile.role !== "owner") return { ok: false, error: "Only the owner can reset a PIN" };
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return { ok: false, error: "User not found" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_pin", { p_user: userId });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/settings/users");
  return { ok: true };
}
