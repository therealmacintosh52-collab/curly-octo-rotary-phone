"use server";

import { revalidatePath } from "next/cache";
import { updateJobSchema } from "@/lib/jobs/schema";
import type { UpdateJobInput } from "@/lib/jobs/schema";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { errorMessage } from "@/lib/utils";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Edit an uninvoiced job (RLS + RPC enforce ownership and locking). */
export async function updateJobAction(input: UpdateJobInput): Promise<ActionResult> {
  const parsed = updateJobSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, ...p } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_job", { p_id: id, p });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/invoices");
  return { ok: true, data: undefined };
}

export async function softDeleteJobAction(id: string, reason: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session.isAdmin) return { ok: false, error: "Admin only" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("soft_delete_job", { p_id: id, p_reason: reason.trim() || null });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/invoices");
  return { ok: true, data: undefined };
}

export async function restoreJobAction(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session.isAdmin) return { ok: false, error: "Admin only" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_job", { p_id: id });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/invoices");
  return { ok: true, data: undefined };
}

export async function deletePhotoAction(photoId: string, jobId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: photo } = await supabase.from("job_photos").select("storage_path").eq("id", photoId).maybeSingle();
  if (!photo) return { ok: false, error: "Photo not found" };
  const { error } = await supabase.from("job_photos").delete().eq("id", photoId);
  if (error) return { ok: false, error: errorMessage(error) };
  await supabase.storage.from("job-photos").remove([photo.storage_path]);
  // Photos live on the car's invoice page now.
  const { data: job } = await supabase.from("jobs").select("invoice_id").eq("id", jobId).maybeSingle();
  if (job?.invoice_id) revalidatePath(`/invoices/${job.invoice_id}`);
  return { ok: true, data: undefined };
}
