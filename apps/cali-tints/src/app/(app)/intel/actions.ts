"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FixDetail } from "@/lib/db/types";
import { fixSchema, type FixInput } from "@/lib/intel/fix-schema";
import { MAX_PHOTO_BYTES } from "@/lib/media/kind";
import { errorMessage } from "@/lib/utils";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function revalidateIntel(id?: string) {
  revalidatePath("/intel", "layout");
  if (id) revalidatePath(`/intel/fixes/${id}`);
}

/** Create or edit a fix (save_fix checks who may; a detailer's part prices are never stored). */
export async function saveFixAction(input: FixInput): Promise<ActionResult<FixDetail>> {
  const parsed = fixSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_fix", { p: parsed.data });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateIntel(data.id);
  return { ok: true, data };
}

/** Photos on a fix, already compressed by the picker: stored under <company>/fixes/<fix>/ and registered. */
export async function addFixPhotosAction(fixId: string, form: FormData): Promise<ActionResult<number>> {
  const session = await getSession();
  const supabase = await createClient();
  const paths: string[] = [];
  for (const entry of form.getAll("photo")) {
    if (!(entry instanceof File) || entry.size === 0) continue;
    if (entry.size > MAX_PHOTO_BYTES) return { ok: false, error: "A photo is over 5 MB" };
    const path = `${session.company.id}/fixes/${fixId}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from("job-photos").upload(path, entry, { contentType: "image/jpeg", upsert: true });
    if (error) return { ok: false, error: error.message };
    paths.push(path);
  }
  if (!paths.length) return { ok: true, data: 0 };
  const { error } = await supabase.rpc("add_fix_media", { p_fix: fixId, p_paths: paths });
  if (error) {
    await supabase.storage.from("job-photos").remove(paths);
    return { ok: false, error: errorMessage(error) };
  }
  revalidateIntel(fixId);
  return { ok: true, data: paths.length };
}

export async function removeFixPhotoAction(mediaId: string, fixId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_fix_media", { p_media: mediaId });
  if (error) return { ok: false, error: errorMessage(error) };
  if (data?.path) {
    try {
      await createAdminClient().storage.from("job-photos").remove([data.path]);
    } catch {
      await supabase.storage.from("job-photos").remove([data.path]);
    }
  }
  revalidateIntel(fixId);
  return { ok: true, data: undefined };
}

export async function deleteFixAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_fix", { p_id: id });
  if (error) return { ok: false, error: errorMessage(error) };
  const paths = (data?.paths ?? []).filter((p): p is string => typeof p === "string" && p.length > 0);
  if (paths.length) {
    try {
      await createAdminClient().storage.from("job-photos").remove(paths);
    } catch {
      await supabase.storage.from("job-photos").remove(paths);
    }
  }
  revalidateIntel();
  return { ok: true, data: undefined };
}

export async function confirmFixAction(id: string, verdict: "fixed" | "not_fixed", note?: string): Promise<ActionResult<FixDetail>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_fix", { p_id: id, p_verdict: verdict, p_note: note?.trim() || null });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateIntel(id);
  return { ok: true, data };
}

export async function unconfirmFixAction(id: string): Promise<ActionResult<FixDetail>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unconfirm_fix", { p_id: id });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateIntel(id);
  return { ok: true, data };
}
