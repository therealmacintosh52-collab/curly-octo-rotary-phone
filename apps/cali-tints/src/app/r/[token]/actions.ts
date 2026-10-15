"use server";

import { headers } from "next/headers";
import { anonClient, isTokenShape } from "@/lib/estimates/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { freezeInvoice } from "@/lib/documents/freeze";
import { errorMessage } from "@/lib/utils";
import { REMOTE_SIGN_CONSENT } from "@/lib/retail/receipt-consent";

export type SignResult = { ok: true } | { ok: false; error: string };

/**
 * The customer signs the paid invoice from their link (a customer who is not at the counter): typed name, drawn
 * mark, time, IP and device are kept. The signed copy is then saved and emailed, as for a signature at the counter.
 */
export async function signReceiptRemoteAction(token: string, input: { name: string; signature_path: string }): Promise<SignResult> {
  if (!isTokenShape(token)) return { ok: false, error: "This link is not valid" };
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
  const client = anonClient();
  const { data: signed, error } = await client.rpc("sign_receipt_by_token", {
    p_token: token,
    p_name: input.name.trim(),
    p_signature_path: input.signature_path,
    p_ip: ip ?? null,
    p_user_agent: h.get("user-agent") ?? null,
    p_consent: REMOTE_SIGN_CONSENT,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  try {
    const { data: r } = await client.rpc("receipt_by_token", { p_token: token });
    if (r && signed) {
      const admin = createAdminClient();
      const { data: est } = await admin.from("estimates").select("id").eq("job_id", signed.job_id).order("created_at").limit(1).maybeSingle();
      await freezeInvoice(admin, r, signed.company_id, est?.id ?? null);
    }
  } catch (err) {
    console.error("freeze invoice (remote)", err instanceof Error ? err.message : err);
  }
  return { ok: true };
}
