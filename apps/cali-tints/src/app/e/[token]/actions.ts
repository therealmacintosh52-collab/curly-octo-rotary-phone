"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { anonClient, isTokenShape, loadPublicEstimate } from "@/lib/estimates/public";
import { appUrl, sendPlainRetailEmail } from "@/lib/retail/email";
import { formatMoney } from "@/lib/money";
import { errorMessage } from "@/lib/utils";

export type PublicResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Counts a view and flips sent → viewed. Fire and forget from the page. */
export async function markEstimateViewedAction(token: string): Promise<void> {
  if (!isTokenShape(token)) return;
  await anonClient().rpc("estimate_mark_viewed", { p_token: token });
}

const respondSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("accept"),
    option_id: z.uuid(),
    approved_line_ids: z.array(z.uuid()).max(50),
    name: z.string().trim().min(2, "Please type your name").max(120),
    signature_path: z.string().min(1).max(300).nullable(),
    pay_choice: z.enum(["deposit", "at_shop"]),
  }),
  z.object({ decision: z.literal("decline"), reason: z.string().trim().max(300).optional() }),
]);
export type RespondInput = z.input<typeof respondSchema>;

/**
 * The customer's answer. The database checks the token, the expiry, that the
 * option belongs to this estimate and that the signature file sits under this
 * estimate's folder; it writes the append-only authorization. The owner
 * gets a short email when the shop has an address on file.
 */
export async function respondEstimateAction(token: string, input: RespondInput): Promise<PublicResult<{ status: "accepted" | "declined"; total: number | null; deposit_required: number | null }>> {
  if (!isTokenShape(token)) return { ok: false, error: "This link is not valid" };
  const parsed = respondSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
  const user_agent = h.get("user-agent") ?? undefined;
  const { data, error } = await anonClient().rpc("estimate_respond", { p_token: token, p: { ...parsed.data, ip, user_agent } });
  if (error) return { ok: false, error: errorMessage(error) };

  if (data.status === "accepted") {
    const e = await loadPublicEstimate(token);
    if (e?.company.email) {
      const chosen = e.options.find((o) => o.id === e.selected_option_id);
      const url = appUrl();
      const lines = [
        `${e.customer.display_name ?? e.customer.first_name} approved estimate ${e.display_number}${e.vehicle?.name ? ` for the ${e.vehicle.name}` : ""}.`,
        chosen ? `Option: ${chosen.name}` : null,
        `Total: ${formatMoney(e.total ?? 0)}${(e.deposit_required ?? 0) > 0 ? ` · deposit ${formatMoney(e.deposit_required ?? 0)}` : ""}`,
        `They chose to ${parsed.data.decision === "accept" && parsed.data.pay_choice === "deposit" ? "pay the deposit online" : "pay at the shop"}.`,
        url ? `Open it: ${url}/retail/estimates/${e.id}` : null,
      ].filter(Boolean) as string[];
      await sendPlainRetailEmail({ to: e.company.email, subject: `${e.display_number} approved · ${e.customer.display_name ?? e.customer.first_name}`, body: lines.join("\n\n"), companyName: e.company.name, refId: e.id });
    }
  }
  return { ok: true, data: { status: data.status, total: data.total ?? null, deposit_required: data.deposit_required ?? null } };
}
