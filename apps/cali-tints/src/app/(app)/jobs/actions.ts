"use server";

import { revalidatePath } from "next/cache";
import { updateJobSchema } from "@/lib/jobs/schema";
import type { UpdateJobInput } from "@/lib/jobs/schema";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { syncJobToQuickBooks } from "@/lib/quickbooks/live";
import { errorMessage } from "@/lib/utils";

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
export async function retailChargeAction(jobId: string): Promise<ActionResult<{ amount_cents: number; tag: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("retail_charge", { p_job_id: jobId });
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true, data: { amount_cents: Number(data.amount_cents), tag: data.tag } };
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
