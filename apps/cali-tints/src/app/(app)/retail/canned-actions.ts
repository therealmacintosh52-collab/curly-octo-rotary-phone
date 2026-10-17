"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { CannedJobInput, PastService } from "@/lib/db/types";
import { errorMessage } from "@/lib/utils";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const money = z.number().min(0).max(100000);
const lineSchema = z.object({
  line_type: z.enum(["service", "labor", "part", "fee", "sublet"]),
  name: z.string().trim().max(120).optional(),
  service_id: z.uuid().optional(),
  qty: z.number().min(0).max(999).optional(),
  hours: z.number().min(0).max(999).optional(),
  rate: z.number().min(0).max(10000).optional(),
  price: money.optional(),
  cost: money.optional(),
  part_number: z.string().trim().max(60).optional(),
  vendor: z.string().trim().max(60).optional(),
  taxable: z.boolean().optional(),
  part_condition: z.enum(["new", "used", "rebuilt", "reconditioned"]).optional(),
});
const cannedSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Give the job a name").max(80),
  category: z.string().trim().max(40).nullable().optional(),
  makes: z.array(z.string().trim().min(1).max(40)).max(40).optional(),
  year_from: z.number().int().min(1900).max(2100).nullable().optional(),
  year_to: z.number().int().min(1900).max(2100).nullable().optional(),
  priority: z.enum(["safety", "soon", "optional"]).optional(),
  lines: z.array(lineSchema).max(40),
  inspection_template_id: z.uuid().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  active: z.boolean().optional(),
});

const refresh = () => {
  revalidatePath("/settings/retail");
  revalidatePath("/retail/estimates/new");
};

/** Save a canned job (owner, admin or advisor; the database checks). */
export async function saveCannedJobAction(input: CannedJobInput): Promise<Result<string>> {
  const parsed = cannedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_canned_job", { p: parsed.data as CannedJobInput });
  if (error || !data) return { ok: false, error: errorMessage(error) };
  refresh();
  return { ok: true, data };
}

export async function deleteCannedJobAction(id: string): Promise<Result> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid input" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_canned_job", { p_id: id });
  if (error) return { ok: false, error: errorMessage(error) };
  refresh();
  return { ok: true, data: undefined };
}

/** What was approved on earlier visits of this car (or this customer): the "Past Services" tab. */
export async function pastServicesAction(input: { vehicleId?: string | null; customerId?: string | null }): Promise<Result<PastService[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("past_services", { p_vehicle: input.vehicleId ?? null, p_customer: input.customerId ?? null });
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true, data: data ?? [] };
}

/** Assign a labor line to a tech (initials show on the line), or clear it. */
export async function setLineTechAction(estimateId: string, lineId: string, techId: string | null): Promise<Result> {
  if (!z.uuid().safeParse(lineId).success || (techId !== null && !z.uuid().safeParse(techId).success)) return { ok: false, error: "Invalid input" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_line_tech", { p_line: lineId, p_tech: techId });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/retail/estimates/${estimateId}`);
  return { ok: true, data: undefined };
}
