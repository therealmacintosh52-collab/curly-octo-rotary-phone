"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { FixInputSchema, type FixInput } from "@/lib/fixes/schema";

type Result = { error?: string; fieldErrors?: Record<string, string> } | undefined;

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "form");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

export async function createFixAction(input: FixInput): Promise<Result> {
  const parsed = FixInputSchema.safeParse(input);
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const { data: fix, error } = await supabase
    .from("fixes")
    .insert({
      author_id: user.id,
      vehicle_id: d.vehicle_id,
      repair_order_id: d.repair_order_id,
      title: d.title,
      year: d.year,
      make: d.make,
      model: d.model,
      engine: d.engine,
      mileage: d.mileage,
      symptoms: d.symptoms,
      freeze_frame_notes: d.freeze_frame_notes,
      tests_performed: d.tests_performed,
      root_cause: d.root_cause,
      fix_description: d.fix_description,
      labor_hours: d.labor_hours,
      source_label: "COMMUNITY",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const children = await Promise.all([
    d.codes.length ? supabase.from("fix_dtcs").insert(d.codes.map((code) => ({ fix_id: fix.id, code }))) : null,
    d.parts.length ? supabase.from("fix_parts").insert(d.parts.map((p, i) => ({ fix_id: fix.id, ...p, sort: i }))) : null,
    d.media.length ? supabase.from("fix_media").insert(d.media.map((m) => ({ fix_id: fix.id, uploaded_by: user.id, ...m }))) : null,
  ]);
  const childError = children.find((c) => c && c.error)?.error;
  if (childError) return { error: `Fix saved but details failed: ${childError.message}` };

  if (d.repair_order_id) {
    await supabase.from("repair_orders").update({ fix_id: fix.id }).eq("id", d.repair_order_id);
    revalidatePath(`/repair-orders/${d.repair_order_id}`);
  }
  revalidatePath("/fixes");
  redirect(`/fixes/${fix.id}`);
}

export async function updateFixAction(id: string, input: FixInput): Promise<Result> {
  const parsed = FixInputSchema.safeParse(input);
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const { error } = await supabase
    .from("fixes")
    .update({
      title: d.title,
      year: d.year,
      make: d.make,
      model: d.model,
      engine: d.engine,
      mileage: d.mileage,
      symptoms: d.symptoms,
      freeze_frame_notes: d.freeze_frame_notes,
      tests_performed: d.tests_performed,
      root_cause: d.root_cause,
      fix_description: d.fix_description,
      labor_hours: d.labor_hours,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  // Record the change note on the revision the trigger just wrote (if content changed).
  if (d.change_note) {
    const { data: rev } = await supabase.from("fix_revisions").select("id").eq("fix_id", id).order("version", { ascending: false }).limit(1).maybeSingle();
    if (rev) await supabase.from("fix_revisions").update({ change_note: d.change_note }).eq("id", rev.id);
  }

  await supabase.from("fix_dtcs").delete().eq("fix_id", id);
  await supabase.from("fix_parts").delete().eq("fix_id", id);
  const { data: existingMedia } = await supabase.from("fix_media").select("id, storage_path").eq("fix_id", id);
  const keep = new Set(d.media.map((m) => m.storage_path));
  const have = new Set((existingMedia ?? []).map((m) => m.storage_path));
  const removedIds = (existingMedia ?? []).filter((m) => !keep.has(m.storage_path)).map((m) => m.id);
  const added = d.media.filter((m) => !have.has(m.storage_path));
  await Promise.all([
    d.codes.length ? supabase.from("fix_dtcs").insert(d.codes.map((code) => ({ fix_id: id, code }))) : null,
    d.parts.length ? supabase.from("fix_parts").insert(d.parts.map((p, i) => ({ fix_id: id, ...p, sort: i }))) : null,
    removedIds.length ? supabase.from("fix_media").delete().in("id", removedIds) : null,
    added.length ? supabase.from("fix_media").insert(added.map((m) => ({ fix_id: id, uploaded_by: user.id, ...m }))) : null,
  ]);
  revalidatePath(`/fixes/${id}`);
  revalidatePath("/fixes");
  redirect(`/fixes/${id}`);
}

export async function confirmFixAction(fixId: string, verdict: "fixed" | "not_fixed", note?: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };
  const { error } = await supabase
    .from("fix_confirmations")
    .upsert({ fix_id: fixId, user_id: user.id, verdict, note: note?.trim() || null }, { onConflict: "fix_id,user_id" });
  if (error) return { error: error.message.includes("own fix") ? "You can't confirm your own fix." : error.message };
  revalidatePath(`/fixes/${fixId}`);
}

export async function removeConfirmationAction(fixId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };
  await supabase.from("fix_confirmations").delete().eq("fix_id", fixId).eq("user_id", user.id);
  revalidatePath(`/fixes/${fixId}`);
}

export async function reportFixAction(fixId: string, reason: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };
  const { error } = await supabase.from("moderation_queue").insert({ kind: "report", fix_id: fixId, reported_by: user.id, reason: reason.trim().slice(0, 500) || "Reported" });
  if (error) return { error: error.message };
  revalidatePath(`/fixes/${fixId}`);
}

export async function moderateAction(queueId: string, decision: "approve" | "reject" | "flag" | "dismiss", note?: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };
  const { data: item } = await supabase.from("moderation_queue").select("id, fix_id").eq("id", queueId).single();
  if (!item) return { error: "Queue item not found" };
  if (item.fix_id && decision !== "dismiss") {
    const status = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "flagged";
    const { error } = await supabase.from("fixes").update({ status }).eq("id", item.fix_id);
    if (error) return { error: error.message };
  }
  const { error } = await supabase
    .from("moderation_queue")
    .update({ status: decision === "dismiss" ? "dismissed" : "resolved", resolved_by: user.id, resolved_at: new Date().toISOString(), resolution_note: note?.trim() || null })
    .eq("id", queueId);
  if (error) return { error: error.message };
  revalidatePath("/admin/moderation");
  if (item.fix_id) revalidatePath(`/fixes/${item.fix_id}`);
}
