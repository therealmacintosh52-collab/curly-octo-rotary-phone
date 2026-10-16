"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { JobFinding, PricedFinding } from "@/lib/db/types";
import { extensionFor, isVideoMime, MAX_VIDEO_BYTES, mediaMime } from "@/lib/media/kind";
import { updateJobSchema } from "@/lib/jobs/schema";
import type { UpdateJobInput } from "@/lib/jobs/schema";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { syncJobToQuickBooks } from "@/lib/quickbooks/live";
import { errorMessage } from "@/lib/utils";
import { appUrl, sendRetailEmail } from "@/lib/retail/email";
import { freezeInvoice } from "@/lib/documents/freeze";
import { customerLinkForJob } from "@/lib/retail/customer-link";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function revalidateJob(id?: string) {
  revalidatePath("/jobs");
  if (id) revalidatePath(`/jobs/${id}`);
  revalidatePath("/invoices");
  revalidatePath("/");
}

/** Keep QuickBooks live after a change: best effort, never blocks the save (the daily sync catches up). */
async function liveQuickBooks(jobId: string, previous?: { dealership_id: string; performed_at: string } | null) {
  try {
    await syncJobToQuickBooks(createAdminClient(), jobId, previous);
  } catch {
    /* no service key or QuickBooks down: the daily sync retries */
  }
}

/** Edit an open job (RLS + RPC enforce ownership and locking). */
export async function updateJobAction(input: UpdateJobInput): Promise<ActionResult> {
  const parsed = updateJobSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, ...p } = parsed.data;
  const supabase = await createClient();
  const { data: before } = await supabase.from("jobs").select("dealership_id, performed_at").eq("id", id).maybeSingle();
  const { error } = await supabase.rpc("update_job", { p_id: id, p });
  if (error) return { ok: false, error: errorMessage(error) };
  await liveQuickBooks(id, before);
  revalidateJob(id);
  return { ok: true, data: undefined };
}

/** A manager typed their PIN on a detailer's phone: the result is a one-time approval for one edit or delete (0070). */
export type PinResult = { ok: true; grant: string } | { ok: false; reason: "wrong" | "locked" | "format"; message: string };
export async function verifyManagerPinAction(pin: string): Promise<PinResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_manager_pin", { p_pin: pin.trim() });
  if (error || !data) return { ok: false, reason: "wrong", message: error ? errorMessage(error) : "Could not check the PIN" };
  if (data.ok && data.grant) return { ok: true, grant: data.grant };
  if (data.reason === "locked") return { ok: false, reason: "locked", message: "Too many wrong PINs. Wait 10 minutes, or ask a manager to edit it." };
  if (data.reason === "format") return { ok: false, reason: "format", message: "The PIN is 4 to 6 digits" };
  return { ok: false, reason: "wrong", message: `That PIN is not right${typeof data.attempts_left === "number" ? ` (${data.attempts_left} tries left)` : ""}` };
}

export async function softDeleteJobAction(id: string, reason: string, approvalGrant?: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("soft_delete_job", { p_id: id, p_reason: reason.trim() || null, p_grant: approvalGrant ?? null });
  if (error) return { ok: false, error: errorMessage(error) };
  await liveQuickBooks(id);
  revalidateJob(id);
  return { ok: true, data: undefined };
}

export async function restoreJobAction(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session.isAdmin) return { ok: false, error: "Admin only" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_job", { p_id: id });
  if (error) return { ok: false, error: errorMessage(error) };
  await liveQuickBooks(id);
  revalidateJob(id);
  return { ok: true, data: undefined };
}

/**
 * Add photos to a job after the fact (from the job page). Files arrive
 * already compressed by the picker. RLS decides who may: admins, or the
 * job's detailer while it is open.
 */
export async function addPhotosAction(jobId: string, form: FormData): Promise<ActionResult<number>> {
  const session = await getSession();
  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("id, company_id, deleted_at").eq("id", jobId).maybeSingle();
  if (!job) return { ok: false, error: "Job not found" };
  if (job.deleted_at) return { ok: false, error: "This job is deleted" };
  let added = 0;
  for (const kind of ["photo", "before", "after"] as const) {
    for (const entry of form.getAll(kind)) {
      if (!(entry instanceof File) || entry.size === 0) continue;
      if (entry.size > MAX_PHOTO_BYTES) return { ok: false, error: "A photo is over 5 MB" };
      const clientId = crypto.randomUUID();
      const path = `${job.company_id}/${jobId}/${clientId}.jpg`;
      const { error: upErr } = await supabase.storage.from("job-photos").upload(path, entry, { contentType: entry.type || "image/jpeg", upsert: true });
      if (upErr) return { ok: false, error: errorMessage(upErr) };
      const { error: rowErr } = await supabase.from("job_photos").insert({ company_id: job.company_id, job_id: jobId, kind, storage_path: path, size_bytes: entry.size, client_id: clientId, created_by: session.userId });
      if (rowErr) {
        await supabase.storage.from("job-photos").remove([path]);
        return { ok: false, error: errorMessage(rowErr) };
      }
      added++;
    }
  }
  revalidateJob(jobId);
  return { ok: true, data: added };
}

export async function deletePhotoAction(photoId: string, jobId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: photo } = await supabase.from("job_photos").select("storage_path").eq("id", photoId).maybeSingle();
  if (!photo) return { ok: false, error: "Photo not found" };
  // RLS on the row decides (admin, or own open job); only then is the file removed.
  const { data: gone, error } = await supabase.from("job_photos").delete().eq("id", photoId).select("id");
  if (error) return { ok: false, error: errorMessage(error) };
  if (!gone?.length) return { ok: false, error: "This photo is locked (the job is on an invoice)" };
  try {
    await createAdminClient().storage.from("job-photos").remove([photo.storage_path]);
  } catch {
    await supabase.storage.from("job-photos").remove([photo.storage_path]); // no service key (local dev): best effort under RLS
  }
  revalidateJob(jobId);
  return { ok: true, data: undefined };
}

// --- Retail (the shop): paid at the counter ------------------------------------

/** What the Clover should charge for this retail job. Any member who can see the job (the Clover shows the amount anyway). */
export async function retailChargeAction(jobId: string): Promise<ActionResult<{ amount_cents: number; tag: string; balance: number; deposit_paid: number; total: number }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("retail_charge", { p_job_id: jobId });
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true, data: { amount_cents: Number(data.amount_cents), tag: data.tag, balance: Number(data.balance), deposit_paid: Number(data.deposit_paid), total: Number(data.total) } };
}

/** The customer signs the receipt at pickup; the PNG was uploaded under the job's folder first. */
export async function signReceiptAction(jobId: string, signaturePath: string, name: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("sign_receipt", { p_job_id: jobId, p_signature_path: signaturePath, p_name: name.trim() });
  if (error) return { ok: false, error: errorMessage(error) };
  // The final invoice and receipt are frozen with the signature and mailed to the customer; a failure never undoes the signature.
  try {
    const session = await getSession();
    const { data: r } = await supabase.rpc("job_receipt", { p_job_id: jobId });
    if (r) {
      const { data: primary } = await supabase.rpc("job_primary_estimate", { p_job: jobId });
      await freezeInvoice(createAdminClient(), r, session.company.id, primary ?? null);
    }
  } catch (err) {
    console.error("freeze invoice", err instanceof Error ? err.message : err);
  }
  revalidateJob(jobId);
  return { ok: true, data: undefined };
}

/** Convert a finished retail repair order to the customer's invoice (RI-…): advisor, admin, owner (0052). */
export async function convertRoToInvoiceAction(jobId: string): Promise<ActionResult<{ invoice_number: string }>> {
  const session = await getSession();
  if (!session.canPrices) return { ok: false, error: "Only the owner, an admin or an advisor converts a repair order to an invoice" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_ro_to_invoice", { p_job: jobId });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateJob(jobId);
  revalidatePath("/retail/invoices");
  revalidatePath("/retail/jobs");
  return { ok: true, data: { invoice_number: data.invoice_number } };
}

const completeSchema = z.object({
  odometer_out: z.union([z.number().int().min(0).max(2000000), z.string().regex(/^[\d,\s]+$/, "Enter the mileage out")]),
  parts_disposition: z.enum(["offered", "returned", "declined"]).nullable().optional(),
  jobs: z.array(z.object({ id: z.uuid(), cause: z.string().trim().max(600), correction: z.string().trim().max(600) })).max(60),
});

/** The tech finishes the work: mileage out, cause and correction for every job, what happens to the replaced parts (0055). */
export async function completeRoWorkAction(jobId: string, input: z.input<typeof completeSchema>): Promise<ActionResult<{ completed_at: string }>> {
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_ro_work", { p_job: jobId, p: { ...parsed.data, odometer_out: String(parsed.data.odometer_out).replace(/[^\d]/g, "") } });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateJob(jobId);
  return { ok: true, data: { completed_at: data.completed_at } };
}

/** A second person signs off the finished work (0055). */
export async function qualityCheckAction(jobId: string, note: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session.isAdmin) return { ok: false, error: "Only the owner, an admin, an advisor or a manager signs off the work" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("quality_check_ro", { p_job: jobId, p_note: note.trim() || null });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateJob(jobId);
  return { ok: true, data: undefined };
}

/** The customer's receipt link, for texting (owner/admin/manager). */
export async function receiptLinkAction(jobId: string): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("receipt_link", { p_job_id: jobId });
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true, data: { url: `${appUrl() ?? ""}/r/${data}` } };
}

/** Write one counter payment on the job: the Clover's result (anyone) or cash, check, Zelle, Venmo or a card entered by hand (owner, admin, advisor; the RPC checks). The job is paid when the balance reaches zero; part payments are allowed. */
export async function recordRetailPaymentAction(jobId: string, input: { amount: number; method: "clover" | "card" | "cash" | "check" | "zelle" | "venmo" | "other"; reference?: string | null }): Promise<ActionResult> {
  if (!(input.amount > 0)) return { ok: false, error: "Amount must be positive" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_retail_payment", { p_job_id: jobId, p_amount: Math.round(input.amount * 100) / 100, p_method: input.method, p_reference: input.reference ?? null });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateJob(jobId);
  return { ok: true, data: undefined };
}

/** "Close job · Picked up": the last step, after the payment and the customer's signature (0056). */
export async function closeRoAction(jobId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_ro", { p_job: jobId });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateJob(jobId);
  return { ok: true, data: undefined };
}

// --- The repair order's notes tab (0043) ---------------------------------------

/** Where a finding lives: on a repair order, or (before the customer approves anything) on an estimate. */
export type FindingRef = string | { estimateId: string };
function revalidateRef(ref: FindingRef) {
  if (typeof ref === "string") revalidateJob(ref);
  else {
    revalidatePath(`/retail/estimates/${ref.estimateId}`);
    revalidatePath("/retail/estimates");
  }
}

const findingInput = z.object({
  job_id: z.uuid().optional(),
  estimate_id: z.uuid().optional(),
  customer_visible: z.boolean().default(true),
  kind: z.enum(["note", "finding"]).default("finding"),
  severity: z.enum(["ok", "soon", "urgent"]).default("soon"),
  title: z.string().trim().min(1, "Give it a title").max(120),
  body: z.string().trim().max(4000).optional().nullable(),
  recommended_service_id: z.uuid().optional().nullable(),
  recommendation: z.enum(["replace", "diagnose", "monitor"]).optional().nullable(),
}).refine((v) => !!v.job_id !== !!v.estimate_id, "A finding belongs to a repair order or an estimate");
export type FindingInput = z.input<typeof findingInput>;

/** A tech's note or finding on a retail job (the RPC checks: admins, or the job's detailer, while the job is open). */
export async function addFindingAction(input: FindingInput): Promise<ActionResult<JobFinding>> {
  const parsed = findingInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_finding", { p: parsed.data });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateRef(parsed.data.job_id ?? { estimateId: parsed.data.estimate_id! });
  return { ok: true, data };
}

export async function updateFindingAction(id: string, ref: FindingRef, input: { customer_visible?: boolean; title?: string; body?: string | null; severity?: "ok" | "soon" | "urgent"; status?: "open" | "declined" | "done"; recommended_service_id?: string | null; recommendation?: "replace" | "diagnose" | "monitor" | null }): Promise<ActionResult<JobFinding>> {
  const parsed = z
    .object({ customer_visible: z.boolean().optional(), title: z.string().trim().min(1).max(120).optional(), body: z.string().trim().max(4000).nullable().optional(), severity: z.enum(["ok", "soon", "urgent"]).optional(), status: z.enum(["open", "declined", "done"]).optional(), recommended_service_id: z.uuid().nullable().optional(), recommendation: z.enum(["replace", "diagnose", "monitor"]).nullable().optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_finding", { p_id: id, p: parsed.data });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateRef(ref);
  return { ok: true, data };
}

const findingLineSchema = z.object({
  line_type: z.enum(["labor", "part", "fee", "sublet"]),
  label: z.string().trim().min(1, "Name every line").max(120),
  hours: z.number().positive().max(200).optional(),
  rate: z.number().min(0).max(5000).optional(),
  qty: z.number().positive().max(999).optional(),
  price: z.number().min(0).max(100000).optional(),
  part_number: z.string().trim().max(60).optional(),
  cost: z.number().min(0).max(100000).optional(),
});

/** Price a finding on the spot: labor, parts and fees go onto one estimate (its own, or a supplement draft on the RO). Owner, admin, advisor. */
export async function priceFindingAction(findingId: string, lines: z.input<typeof findingLineSchema>[]): Promise<ActionResult<PricedFinding>> {
  const session = await getSession();
  if (!session.canPrices) return { ok: false, error: "Only the owner, an admin or an advisor prices a finding" };
  const parsed = z.array(findingLineSchema).min(1, "Add at least one line").max(30).safeParse(lines);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_finding_lines", { p_finding: findingId, p_lines: parsed.data });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/retail/estimates/${data.estimate_id}`);
  revalidatePath("/retail/estimates");
  if (data.job_id) revalidateJob(data.job_id);
  return { ok: true, data };
}

const REC_WORD = { replace: "We recommend replacing it.", diagnose: "We recommend a diagnosis.", monitor: "We recommend keeping an eye on it." } as const;

/** Email one finding to the customer (what it is, what we recommend, the link to see the photos). Owner, admin, advisor. */
export async function emailFindingAction(findingId: string): Promise<ActionResult<{ emailed: boolean; note: string | null; url: string }>> {
  const session = await getSession();
  if (!session.canPrices) return { ok: false, error: "Only the owner, an admin or an advisor sends findings" };
  const supabase = await createClient();
  const { data: f } = await supabase.from("job_findings").select("id, title, body, recommendation, customer_visible, kind, estimate_id, job_id").eq("id", findingId).maybeSingle();
  if (!f) return { ok: false, error: "Finding not found" };
  if (f.customer_visible === false) return { ok: false, error: "That one is marked internal only" };
  const base = appUrl() ?? "";
  let url = "";
  let contact: { first_name: string; email: string | null; vehicle: string | null } | null = null;
  const { data: est } = f.estimate_id ? await supabase.rpc("estimate_detail", { p_id: f.estimate_id }) : { data: null };
  if (est && !est.applied_at && ["draft", "sent", "viewed"].includes(est.status)) {
    const { data: token } = await supabase.rpc("estimate_link", { p_id: est.id });
    if (token) url = `${base}/e/${token}`;
    contact = { first_name: est.customer.first_name || est.customer.display_name || "there", email: est.customer.email, vehicle: est.vehicle?.name ?? null };
    await supabase.rpc("mark_findings_sent", { p_estimate: est.id });
  }
  const jobId = f.job_id;
  if (!url && jobId) {
    url = (await customerLinkForJob(supabase, jobId, base)) ?? "";
    const { data: j } = await supabase.from("jobs").select("year, make, model, customer:customers(first_name, display_name, email)").eq("id", jobId).maybeSingle();
    const c = (j as unknown as { year: number | null; make: string | null; model: string | null; customer: { first_name: string; display_name: string | null; email: string | null } | null } | null);
    if (c) contact = { first_name: c.customer?.first_name || c.customer?.display_name || "there", email: c.customer?.email ?? null, vehicle: [c.year, c.make, c.model].filter(Boolean).join(" ") || null };
  }
  if (!url || !contact) return { ok: false, error: "There is no customer link for this finding yet" };
  const { data: rs } = await supabase.from("retail_settings").select("email_templates").eq("company_id", session.company.id).maybeSingle();
  const about = [`About: ${f.title}`, f.body ? f.body : null, f.recommendation ? REC_WORD[f.recommendation as keyof typeof REC_WORD] : null].filter(Boolean).join("\n");
  const r = await sendRetailEmail({ to: contact.email, key: "findings_ready", templates: rs?.email_templates ?? null, vars: { first_name: contact.first_name, vehicle: contact.vehicle ?? "car", findings_url: url, company: session.company.name }, companyName: session.company.name, replyTo: session.company.email, refId: findingId, append: about });
  return { ok: true, data: { emailed: r.ok, note: r.ok ? null : r.error, url } };
}

/** Remove a note or finding and its files (the RPC decides who may; the files go afterwards, best effort). */
export async function deleteFindingAction(id: string, ref: FindingRef): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_finding", { p_id: id });
  if (error) return { ok: false, error: errorMessage(error) };
  const paths = (data?.paths ?? []).filter((p): p is string => typeof p === "string" && p.length > 0);
  if (paths.length) {
    try {
      await createAdminClient().storage.from("job-photos").remove(paths);
    } catch {
      await supabase.storage.from("job-photos").remove(paths);
    }
  }
  revalidateRef(ref);
  return { ok: true, data: undefined };
}

/** Photos on a finding, already compressed by the picker (same path as job photos, kind "finding"). */
export async function addFindingPhotosAction(jobId: string, findingId: string, form: FormData): Promise<ActionResult<number>> {
  const session = await getSession();
  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("id, company_id, deleted_at").eq("id", jobId).maybeSingle();
  if (!job) return { ok: false, error: "Job not found" };
  if (job.deleted_at) return { ok: false, error: "This job is deleted" };
  let added = 0;
  for (const entry of form.getAll("photo")) {
    if (!(entry instanceof File) || entry.size === 0) continue;
    if (entry.size > MAX_PHOTO_BYTES) return { ok: false, error: "A photo is over 5 MB" };
    const mime = mediaMime(entry.type, entry.name) ?? "image/jpeg";
    if (isVideoMime(mime)) continue;
    const clientId = crypto.randomUUID();
    const path = `${job.company_id}/${jobId}/${clientId}.${extensionFor(mime)}`;
    const { error: upErr } = await supabase.storage.from("job-photos").upload(path, entry, { contentType: mime, upsert: true });
    if (upErr) return { ok: false, error: errorMessage(upErr) };
    const { error: rowErr } = await supabase.from("job_photos").insert({ company_id: job.company_id, job_id: jobId, kind: "finding", storage_path: path, size_bytes: entry.size, client_id: clientId, finding_id: findingId, mime, created_by: session.userId });
    if (rowErr) {
      await supabase.storage.from("job-photos").remove([path]);
      return { ok: false, error: errorMessage(rowErr) };
    }
    added++;
  }
  revalidateJob(jobId);
  return { ok: true, data: added };
}

/** The browser uploaded a clip (resumable) straight into the job's folder; register the row for it. */
export async function registerFindingMediaAction(jobId: string, findingId: string, input: { path: string; mime: string; size: number; duration: number | null }): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("id, company_id, deleted_at").eq("id", jobId).maybeSingle();
  if (!job) return { ok: false, error: "Job not found" };
  const mime = mediaMime(input.mime);
  if (!mime) return { ok: false, error: "That file type is not supported" };
  if (!(input.size > 0) || input.size > MAX_VIDEO_BYTES) return { ok: false, error: "The clip is over 100 MB" };
  const prefix = `${job.company_id}/${jobId}/`;
  if (!input.path.startsWith(prefix) || /[^A-Za-z0-9._/-]/.test(input.path)) return { ok: false, error: "Bad path" };
  const clientId = input.path.slice(prefix.length).split(".")[0];
  const { data, error } = await supabase
    .from("job_photos")
    .insert({ company_id: job.company_id, job_id: jobId, kind: isVideoMime(mime) ? "video" : "finding", storage_path: input.path, size_bytes: Math.round(input.size), client_id: /^[0-9a-f-]{36}$/i.test(clientId) ? clientId : crypto.randomUUID(), finding_id: findingId, mime, duration_s: input.duration === null ? null : Math.round(input.duration * 100) / 100, created_by: session.userId })
    .select("id")
    .single();
  if (error) {
    await supabase.storage.from("job-photos").remove([input.path]);
    return { ok: false, error: errorMessage(error) };
  }
  revalidateJob(jobId);
  return { ok: true, data: { id: data.id } };
}


// --- Findings on an estimate (0050): the same notes, photos and clips before anything is approved ---

/** Photos for a finding on an estimate: stored under the company's estimates folder, then registered through the RPC. */
export async function addEstimateFindingPhotosAction(estimateId: string, findingId: string, form: FormData): Promise<ActionResult<number>> {
  const session = await getSession();
  const supabase = await createClient();
  let added = 0;
  for (const entry of form.getAll("photo")) {
    if (!(entry instanceof File) || entry.size === 0) continue;
    if (entry.size > MAX_PHOTO_BYTES) return { ok: false, error: "A photo is over 5 MB" };
    const mime = mediaMime(entry.type, entry.name) ?? "image/jpeg";
    if (isVideoMime(mime)) continue;
    const path = `${session.company.id}/estimates/${estimateId}/${crypto.randomUUID()}.${extensionFor(mime)}`;
    const { error: upErr } = await supabase.storage.from("job-photos").upload(path, entry, { contentType: mime, upsert: true });
    if (upErr) return { ok: false, error: errorMessage(upErr) };
    const { error: rowErr } = await supabase.rpc("add_finding_media", { p_finding: findingId, p: { path, mime, size: entry.size } });
    if (rowErr) {
      await supabase.storage.from("job-photos").remove([path]);
      return { ok: false, error: errorMessage(rowErr) };
    }
    added++;
  }
  revalidateRef({ estimateId });
  return { ok: true, data: added };
}

/** A clip uploaded straight to storage by the browser: register it on the finding. */
export async function registerEstimateFindingMediaAction(estimateId: string, findingId: string, input: { path: string; mime: string; size: number; duration: number | null }): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  const supabase = await createClient();
  const mime = mediaMime(input.mime);
  if (!mime) return { ok: false, error: "That file type is not supported" };
  if (!(input.size > 0) || input.size > MAX_VIDEO_BYTES) return { ok: false, error: "The clip is over 100 MB" };
  if (!input.path.startsWith(`${session.company.id}/estimates/${estimateId}/`)) return { ok: false, error: "Bad path" };
  const { data, error } = await supabase.rpc("add_finding_media", { p_finding: findingId, p: { path: input.path, mime, size: Math.round(input.size), duration: input.duration === null ? null : Math.round(input.duration * 100) / 100 } });
  if (error) {
    await supabase.storage.from("job-photos").remove([input.path]);
    return { ok: false, error: errorMessage(error) };
  }
  revalidateRef({ estimateId });
  return { ok: true, data: { id: data.id } };
}
