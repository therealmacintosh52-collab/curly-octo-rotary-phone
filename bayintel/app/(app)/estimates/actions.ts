"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Line = z.object({
  kind: z.enum(["part", "labor", "fee"]),
  description: z.string().trim().min(1).max(200),
  part_number: z.string().trim().max(60).nullable().default(null),
  quantity: z.coerce.number().min(0).max(9999).default(1),
  unit_price: z.coerce.number().min(0).max(1000000).default(0),
  hours: z.coerce.number().min(0).max(500).nullable().default(null),
  taxable: z.boolean().nullable().default(null),
});
const EstimateInput = z.object({
  vehicle_id: z.string().uuid().nullable().default(null),
  repair_order_id: z.string().uuid().nullable().default(null),
  customer_name: z.string().trim().max(120).nullable().default(null),
  customer_email: z.string().trim().email().max(200).nullable().or(z.literal("")).default(null),
  customer_phone: z.string().trim().max(40).nullable().default(null),
  labor_rate: z.coerce.number().min(0).max(2000),
  tax_rate: z.coerce.number().min(0).max(1),
  tax_parts: z.boolean().default(true),
  tax_labor: z.boolean().default(false),
  notes: z.string().trim().max(4000).nullable().default(null),
  valid_until: z.string().nullable().default(null),
  status: z.enum(["draft", "sent", "approved", "declined"]).default("draft"),
  lines: z.array(Line).min(1).max(60),
});
export type EstimateInput = z.input<typeof EstimateInput>;

export async function saveEstimateAction(id: string | null, input: EstimateInput): Promise<{ error?: string } | undefined> {
  const parsed = EstimateInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid estimate" };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };
  const { data: profile } = await supabase.from("profiles").select("shop_id").eq("id", user.id).single();
  const row = {
    vehicle_id: d.vehicle_id,
    repair_order_id: d.repair_order_id,
    customer_name: d.customer_name,
    customer_email: d.customer_email || null,
    customer_phone: d.customer_phone,
    labor_rate: d.labor_rate,
    tax_rate: d.tax_rate,
    tax_parts: d.tax_parts,
    tax_labor: d.tax_labor,
    notes: d.notes,
    valid_until: d.valid_until || null,
    status: d.status,
  };
  let estimateId = id;
  if (estimateId) {
    const { error } = await supabase.from("estimates").update(row).eq("id", estimateId);
    if (error) return { error: error.message };
    await supabase.from("estimate_lines").delete().eq("estimate_id", estimateId);
  } else {
    const { data, error } = await supabase
      .from("estimates")
      .insert({ ...row, author_id: user.id, shop_id: profile?.shop_id ?? null })
      .select("id")
      .single();
    if (error) return { error: error.message };
    estimateId = data.id;
  }
  const { error: lineErr } = await supabase.from("estimate_lines").insert(d.lines.map((l, i) => ({ ...l, estimate_id: estimateId!, sort: i })));
  if (lineErr) return { error: lineErr.message };
  revalidatePath("/estimates");
  revalidatePath(`/estimates/${estimateId}`);
  redirect(`/estimates/${estimateId}`);
}

export async function setEstimateStatusAction(id: string, status: "draft" | "sent" | "approved" | "declined") {
  const supabase = await createClient();
  const { error } = await supabase.from("estimates").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/estimates/${id}`);
  revalidatePath("/estimates");
}

export async function deleteEstimateAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("estimates").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/estimates");
  redirect("/estimates");
}
