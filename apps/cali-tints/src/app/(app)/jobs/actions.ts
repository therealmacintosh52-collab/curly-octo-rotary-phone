"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { JobFinding } from "@/lib/db/types";
import { extensionFor, isVideoMime, MAX_VIDEO_BYTES, mediaMime } from "@/lib/media/kind";
import { updateJobSchema } from "@/lib/jobs/schema";
import type { UpdateJobInput } from "@/lib/jobs/schema";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { syncJobToQuickBooks } from "@/lib/quickbooks/live";
import { errorMessage } from "@/lib/utils";
import { appUrl } from "@/lib/retail/email";

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

export async function softDeleteJobAction(id: string, reason: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session.isAdmin) return { ok: false, error: "Admin only" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("soft_delete_job", { p_id: id, p_reason: reason.trim() || null });
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

/** Write the counter payment on the job: the Clover's result (anyone) or cash/check (owner, admin; the RPC checks). */
export async function recordRetailPaymentAction(jobId: string, input: { amount: number; method: "clover" | "cash" | "check" | "other"; reference?: string | null }): Promise<ActionResult> {
  if (!(input.amount > 0)) return { ok: false, error: "Amount must be positive" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_retail_payment", { p_job_id: jobId, p_amount: Math.round(input.amount * 100) / 100, p_method: input.method, p_reference: input.reference ?? null });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateJob(jobId);
  return { ok: true, data: undefined };
}

// --- The repair order's notes tab (0043) ---------------------------------------

const findingInput = z.object({
  job_id: z.uuid(),
  kind: z.enum(["note", "finding"]).default("finding"),
  severity: z.enum(["ok", "soon", "urgent"]).default("soon"),
  title: z.string().trim().min(1, "Give it a title").max(120),
  body: z.string().trim().max(4000).optional().nullable(),
  recommended_service_id: z.uuid().optional().nullable(),
});
export type FindingInput = z.input<typeof findingInput>;

/** A tech's note or finding on a retail job (the RPC checks: admins, or the job's detailer, while the job is open). */
export async function addFindingAction(input: FindingInput): Promise<ActionResult<JobFinding>> {
  const parsed = findingInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_finding", { p: parsed.data });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateJob(parsed.data.job_id);
  return { ok: true, data };
}

export async function updateFindingAction(id: string, jobId: string, input: { title?: string; body?: string | null; severity?: "ok" | "soon" | "urgent"; status?: "open" | "declined" | "done"; recommended_service_id?: string | null }): Promise<ActionResult<JobFinding>> {
  const parsed = z
    .object({ title: z.string().trim().min(1).max(120).optional(), body: z.string().trim().max(4000).nullable().optional(), severity: z.enum(["ok", "soon", "urgent"]).optional(), status: z.enum(["open", "declined", "done"]).optional(), recommended_service_id: z.uuid().nullable().optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_finding", { p_id: id, p: parsed.data });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateJob(jobId);
  return { ok: true, data };
}

/** Remove a note or finding and its files (the RPC decides who may; the files go afterwards, best effort). */
export async function deleteFindingAction(id: string, jobId: string): Promise<ActionResult> {
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
  revalidateJob(jobId);
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
