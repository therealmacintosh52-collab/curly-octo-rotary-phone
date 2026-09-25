"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { errorMessage } from "@/lib/utils";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const serviceLine = z.object({
  service_id: z.uuid(),
  price: z.number().min(0),
  override_reason: z.string().trim().max(500).nullable().optional(),
});

const updateJobSchema = z.object({
  id: z.uuid(),
  dealership_id: z.uuid().optional(),
  detailer_id: z.uuid().optional(),
  tag_number: z.string().trim().min(1).max(32),
  vin: z.string().trim().toUpperCase().regex(/^[A-HJ-NPR-Z0-9]{17}$/).nullable(),
  year: z.number().int().min(1900).max(2100).nullable(),
  make: z.string().trim().max(60).nullable(),
  model: z.string().trim().max(80).nullable(),
  color: z.string().trim().max(40).nullable(),
  performed_at: z.string().datetime({ offset: true }),
  ro_po_number: z.string().trim().max(40).nullable(),
  notes: z.string().trim().max(2000).nullable(),
  services: z.array(serviceLine).min(1),
});
export type UpdateJobInput = z.input<typeof updateJobSchema>;

/** Edit an uninvoiced job (RLS + RPC enforce ownership and locking). */
export async function updateJobAction(input: UpdateJobInput): Promise<ActionResult> {
  const parsed = updateJobSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, ...p } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_job", { p_id: id, p });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  return { ok: true, data: undefined };
}

export async function softDeleteJobAction(id: string, reason: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session.isAdmin) return { ok: false, error: "Admin only" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("soft_delete_job", { p_id: id, p_reason: reason.trim() || null });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  return { ok: true, data: undefined };
}

export async function restoreJobAction(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session.isAdmin) return { ok: false, error: "Admin only" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_job", { p_id: id });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  return { ok: true, data: undefined };
}

export async function deletePhotoAction(photoId: string, jobId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: photo } = await supabase.from("job_photos").select("storage_path").eq("id", photoId).maybeSingle();
  if (!photo) return { ok: false, error: "Photo not found" };
  const { error } = await supabase.from("job_photos").delete().eq("id", photoId);
  if (error) return { ok: false, error: errorMessage(error) };
  await supabase.storage.from("job-photos").remove([photo.storage_path]);
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true, data: undefined };
}
