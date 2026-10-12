"use server";

import { revalidatePath } from "next/cache";
import { updateJobSchema } from "@/lib/jobs/schema";
import type { UpdateJobInput } from "@/lib/jobs/schema";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { errorMessage } from "@/lib/utils";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function revalidateJob(id?: string) {
  revalidatePath("/jobs");
  if (id) revalidatePath(`/jobs/${id}`);
  revalidatePath("/invoices");
  revalidatePath("/");
}

/** Edit an open job (RLS + RPC enforce ownership and locking). */
export async function updateJobAction(input: UpdateJobInput): Promise<ActionResult> {
  const parsed = updateJobSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, ...p } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_job", { p_id: id, p });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateJob(id);
  return { ok: true, data: undefined };
}

export async function softDeleteJobAction(id: string, reason: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session.isAdmin) return { ok: false, error: "Admin only" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("soft_delete_job", { p_id: id, p_reason: reason.trim() || null });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateJob(id);
  return { ok: true, data: undefined };
}

export async function restoreJobAction(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session.isAdmin) return { ok: false, error: "Admin only" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_job", { p_id: id });
  if (error) return { ok: false, error: errorMessage(error) };
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
  for (const kind of ["before", "after"] as const) {
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
