"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { EstimatePayload, EstimateStatus } from "@/lib/db/types";
import { appUrl, sendRetailEmail } from "@/lib/retail/email";
import { formatDate } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { freezeApproval } from "@/lib/documents/freeze";
import { errorMessage } from "@/lib/utils";
import { customerLinkForJob } from "@/lib/retail/customer-link";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const money = z.number().min(0).max(100000);
const extra = { job: z.string().max(40).optional(), section: z.enum(["diagnosis", "repair"]).optional(), taxable: z.boolean().nullable().optional(), cost: money.nullable().optional(), finding_id: z.uuid().nullable().optional() };
/** A service line prices through the size matrix; labor, parts, fees and sublets carry their own numbers (0044). */
const lineSchema = z.discriminatedUnion("line_type", [
  z.object({ line_type: z.literal("service"), service_id: z.uuid(), qty: z.number().positive().max(99).optional(), label: z.string().trim().max(120).nullable().optional(), price: money.nullable().optional(), modifiers: z.array(z.string().trim().max(40)).max(10).optional(), ...extra }),
  z.object({ line_type: z.literal("labor"), label: z.string().trim().min(1, "Say what the labor is").max(120), hours: z.number().min(0.05).max(999), rate: z.number().min(0).max(10000).nullable().optional(), ...extra }),
  z.object({ line_type: z.literal("part"), label: z.string().trim().min(1, "Name the part").max(120), qty: z.number().positive().max(999).optional(), price: money, part_number: z.string().trim().max(60).nullable().optional(), vendor: z.string().trim().max(80).nullable().optional(), ...extra }),
  z.object({ line_type: z.enum(["fee", "sublet"]), label: z.string().trim().min(1, "Name it").max(120), qty: z.number().positive().max(999).optional(), price: money, vendor: z.string().trim().max(80).nullable().optional(), ...extra }),
]);
const lineInput = z.preprocess((v) => (v && typeof v === "object" && !("line_type" in v) ? { ...(v as object), line_type: "service" } : v), lineSchema);
const payloadSchema = z.object({
  job_id: z.uuid().nullable().optional(),
  customer_id: z.uuid().optional(),
  vehicle_id: z.uuid().nullable().optional(),
  size_class: z.enum(["compact", "sedan", "suv_truck", "xl"]).optional(),
  expires_at: z.string().nullable().optional(),
  po_number: z.string().trim().max(40).nullable().optional(),
  odometer: z.number().int().positive().max(9_999_999).nullable().optional(),
  internal_notes: z.string().trim().max(4000).nullable().optional(),
  customer_notes: z.string().trim().max(4000).nullable().optional(),
  customer_concern: z.string().trim().max(2000).nullable().optional(),
  options: z
    .array(z.object({ tier: z.enum(["good", "better", "best", "single"]), name: z.string().trim().min(1).max(60), description: z.string().trim().max(300).nullable().optional(), recommended: z.boolean().optional(), jobs: z.array(z.object({ key: z.string().min(1).max(40), title: z.string().trim().min(1).max(80), kind: z.enum(["diagnosis", "repair"]).optional(), priority: z.enum(["safety", "soon", "optional"]).optional() })).max(30).optional(), lines: z.array(lineInput).max(60) }))
    .min(1)
    .max(3)
    .optional(),
  addons: z.array(z.preprocess((v) => (v && typeof v === "object" && !("line_type" in v) ? { ...(v as object), line_type: "service" } : v), z.object({ line_type: z.literal("service"), service_id: z.uuid(), qty: z.number().positive().max(99).optional(), label: z.string().trim().max(120).nullable().optional(), price: money.nullable().optional(), modifiers: z.array(z.string().trim().max(40)).max(10).optional(), default_on: z.boolean().optional(), ...extra }))).max(20).optional(),
});

function revalidate(id?: string, customerId?: string | null) {
  revalidatePath("/retail/estimates");
  revalidatePath("/retail");
  if (id) revalidatePath(`/retail/estimates/${id}`);
  if (customerId) revalidatePath(`/retail/customers/${customerId}`);
}

export async function createEstimateAction(input: EstimatePayload): Promise<ActionResult<{ id: string; display_number: string }>> {
  const session = await getSession();
  if (!session.canPrices) return { ok: false, error: "Only the owner or an admin writes estimates" };
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!parsed.data.customer_id && !parsed.data.job_id) return { ok: false, error: "Pick the customer" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_estimate", { p: parsed.data });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidate(data.id, parsed.data.customer_id ?? data.customer_id);
  if (parsed.data.job_id) revalidatePath(`/jobs/${parsed.data.job_id}`);
  return { ok: true, data: { id: data.id, display_number: data.display_number } };
}

export async function updateEstimateAction(id: string, input: EstimatePayload): Promise<ActionResult> {
  const session = await getSession();
  if (!session.canPrices) return { ok: false, error: "Only the owner or an admin writes estimates" };
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_estimate", { p_id: id, p: parsed.data });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidate(id);
  return { ok: true, data: undefined };
}

/** Mark sent and email the link (when the customer has an email and email is configured). Returns the public URL either way. */
export async function sendEstimateAction(id: string, via: "email" | "link"): Promise<ActionResult<{ url: string; emailed: boolean; note: string | null }>> {
  const session = await getSession();
  if (!session.canPrices) return { ok: false, error: "Only the owner or an admin sends estimates" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_estimate", { p_id: id });
  if (error) return { ok: false, error: errorMessage(error) };
  const base = appUrl() ?? "";
  const url = `${base}/e/${data.token}`;
  let emailed = false;
  let note: string | null = null;
  if (via === "email") {
    const { data: e } = await supabase.rpc("estimate_detail", { p_id: id });
    const { data: rs } = await supabase.from("retail_settings").select("email_templates").eq("company_id", session.company.id).maybeSingle();
    const r = await sendRetailEmail({
      to: e?.customer.email,
      key: "estimate_sent",
      templates: rs?.email_templates ?? null,
      vars: { first_name: e?.customer.first_name || e?.customer.display_name || "there", vehicle: e?.vehicle?.name ?? "your car", estimate_url: url, expires: data.expires_at ? formatDate(data.expires_at) : "", company: session.company.name },
      companyName: session.company.name,
      replyTo: session.company.email,
      refId: id,
    });
    emailed = r.ok;
    if (!r.ok) note = r.error;
  }
  revalidate(id);
  return { ok: true, data: { url, emailed, note } };
}

export async function markEstimateAcceptedAction(id: string, optionId: string, lineIds: string[], name: string, method: "in_person" | "phone" | "email", signaturePath: string | null = null): Promise<ActionResult> {
  const session = await getSession();
  if (!session.canPrices) return { ok: false, error: "Only the owner, an admin or an advisor records an approval" };
  const supabase = await createClient();
  // In person, the customer signs (unless the shop turned that off in Settings).
  if (method === "in_person" && !signaturePath) {
    const { data: rs } = await supabase.from("retail_settings").select("signature_required_estimate").maybeSingle();
    if (rs?.signature_required_estimate ?? true) return { ok: false, error: "The customer signs first" };
  }
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null;
  const { error } = await supabase.rpc("mark_estimate_accepted", { p_id: id, p_option: optionId, p_line_ids: lineIds, p_name: name.trim() || null, p_method: method, p_signature_path: signaturePath, p_ip: ip, p_user_agent: h.get("user-agent") });
  if (error) return { ok: false, error: errorMessage(error) };
  // The signed paper is frozen the moment it is signed (and mailed to the customer); a failure here never undoes the approval.
  try {
    const { data: e } = await supabase.rpc("estimate_detail", { p_id: id });
    if (e) await freezeApproval(createAdminClient(), e, session.company.id);
  } catch (err) {
    console.error("freeze approval", err instanceof Error ? err.message : err);
  }
  revalidate(id);
  return { ok: true, data: undefined };
}

export async function declineEstimateAction(id: string, reason: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session.canPrices) return { ok: false, error: "Only the owner or an admin declines an estimate" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_estimate", { p_id: id, p_reason: reason.trim() || null });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidate(id);
  return { ok: true, data: undefined };
}

export async function convertEstimateAction(id: string, input: { tag_number?: string; performed_at?: string; notes?: string }): Promise<ActionResult<{ jobId: string }>> {
  const session = await getSession();
  if (!session.canPrices) return { ok: false, error: "Only the owner or an admin converts an estimate" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_estimate_to_job", { p_id: id, p: { tag_number: input.tag_number?.trim() || undefined, performed_at: input.performed_at || undefined, notes: input.notes?.trim() || undefined } });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidate(id);
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${data.id}`);
  return { ok: true, data: { jobId: data.id } };
}

export type EstimateStatusFilter = "all" | "open" | EstimateStatus;


/**
 * "Send findings": what the tech found (photos, clips, recommendations) goes to
 * the customer by email or text, as a link to the estimate or, once it is
 * approved, to the invoice. Text is the phone's own messaging app (`sms:` link
 * opened by the button); this records that it went out and builds the link.
 */
export async function sendFindingsAction(estimateId: string, via: "email" | "text"): Promise<ActionResult<{ url: string; emailed: boolean; note: string | null }>> {
  const session = await getSession();
  if (!session.canPrices) return { ok: false, error: "Only the owner, an admin or an advisor sends findings" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_findings_sent", { p_estimate: estimateId });
  if (error) return { ok: false, error: errorMessage(error) };
  const base = appUrl() ?? "";
  let url = `${base}/e/${data.token}`;
  if (data.job_id) url = (await customerLinkForJob(supabase, data.job_id, base)) ?? url;
  let emailed = false;
  let note: string | null = null;
  if (via === "email") {
    const { data: e } = await supabase.rpc("estimate_detail", { p_id: estimateId });
    const { data: rs } = await supabase.from("retail_settings").select("email_templates").eq("company_id", session.company.id).maybeSingle();
    const r = await sendRetailEmail({
      to: e?.customer.email,
      key: "findings_ready",
      templates: rs?.email_templates ?? null,
      vars: { first_name: e?.customer.first_name || e?.customer.display_name || "there", vehicle: e?.vehicle?.name ?? "car", findings_url: url, company: session.company.name },
      companyName: session.company.name,
      replyTo: session.company.email,
      refId: estimateId,
    });
    emailed = r.ok;
    if (!r.ok) note = r.error;
  }
  revalidate(estimateId);
  return { ok: true, data: { url, emailed, note } };
}

/** Remove a draft that never went anywhere (blank or abandoned): its rows and its photos and clips. */
export async function deleteDraftEstimateAction(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session.canPrices) return { ok: false, error: "Only the owner, an admin or an advisor removes a draft" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_draft_estimate", { p_id: id });
  if (error) return { ok: false, error: errorMessage(error) };
  const paths = (data?.paths ?? []).filter((p): p is string => typeof p === "string" && p.length > 0);
  if (paths.length) {
    try {
      await createAdminClient().storage.from("job-photos").remove(paths);
    } catch {
      await supabase.storage.from("job-photos").remove(paths);
    }
  }
  revalidatePath("/retail/estimates");
  revalidatePath("/retail");
  return { ok: true, data: undefined };
}

/** The customer's link for an estimate (staff who may send it): to text or copy an extra-work approval. */
export async function estimateLinkAction(id: string): Promise<ActionResult<string>> {
  const session = await getSession();
  if (!session.canPrices) return { ok: false, error: "Only the owner, an admin or an advisor shares the link" };
  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("estimate_link", { p_id: id });
  if (error || !token) return { ok: false, error: error ? errorMessage(error) : "No link yet" };
  return { ok: true, data: `${appUrl() ?? ""}/e/${token}` };
}

// --- Transfer a visit to a coworker (0058) ---------------------------------------------------------
export async function transferCandidatesAction(): Promise<ActionResult<import("@/lib/db/types").TransferCandidate[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("transfer_candidates");
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true, data: data ?? [] };
}

export async function transferEstimateAction(id: string, to: string, status: string, message: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_estimate", { p_estimate: id, p_to: to, p_status: status, p_message: message.trim() || null });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/retail");
  revalidate(id);
  return { ok: true, data: undefined };
}

/** The technicians a work order can be sent to (names for the picker only). */
export async function retailTechniciansAction(): Promise<ActionResult<import("@/lib/db/types").RetailTechnician[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("retail_technicians");
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true, data: data ?? [] };
}

/** The advisor sends an approved work order to a technician (null puts it back with the advisor). */
export async function sendToTechAction(id: string, tech: string | null): Promise<ActionResult> {
  const session = await getSession();
  if (!session.canPrices) return { ok: false, error: "Only the owner, an admin or an advisor sends a work order to a tech" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_to_tech", { p_estimate: id, p_tech: tech });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/retail");
  revalidate(id);
  return { ok: true, data: undefined };
}

export async function respondTransferAction(id: string, accept: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_transfer", { p_id: id, p_accept: accept });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/retail");
  return { ok: true, data: undefined };
}

export async function cancelTransferAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_transfer", { p_id: id });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/retail");
  return { ok: true, data: undefined };
}

/** Label, due times, status word, parts and fleet number on a visit (0061). */
export async function setEstimateMetaAction(id: string, patch: Partial<Record<"label" | "due_in" | "due_out" | "status_label" | "parts_status" | "fleet_number", string | null>>): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_estimate_meta", { p_id: id, p: patch as Record<string, string | null> });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidate(id);
  revalidatePath("/retail");
  return { ok: true, data: undefined };
}
