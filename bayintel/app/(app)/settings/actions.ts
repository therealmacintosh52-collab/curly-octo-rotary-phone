"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const ProfileInput = z.object({ display_name: z.string().trim().min(2).max(60), role: z.enum(["diy", "technician", "shop_owner"]) });
const ShopInput = z.object({
  name: z.string().trim().min(2).max(120),
  labor_rate: z.coerce.number().min(0).max(2000),
  tax_rate: z.coerce.number().min(0).max(100),
  phone: z.string().trim().max(40).nullable().default(null),
  email: z.string().trim().email().max(200).or(z.literal("")).nullable().default(null),
  address: z.string().trim().max(300).nullable().default(null),
});

export async function updateProfileAction(form: FormData): Promise<void> {
  const parsed = ProfileInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`/settings?error=${encodeURIComponent("Invalid profile")}`);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/settings?error=${encodeURIComponent("Sign in required")}`);
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const patch = me?.role === "admin" ? { display_name: parsed.data.display_name } : parsed.data;
  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

export async function saveShopAction(form: FormData): Promise<void> {
  const parsed = ShopInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`/settings?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid shop")}`);
  const d = { ...parsed.data, tax_rate: parsed.data.tax_rate / 100, email: parsed.data.email || null };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/settings?error=${encodeURIComponent("Sign in required")}`);
  const { data: profile } = await supabase.from("profiles").select("shop_id").eq("id", user.id).single();
  if (profile?.shop_id) {
    const { error } = await supabase.from("shops").update(d).eq("id", profile.shop_id);
    if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  } else {
    const { data: shop, error } = await supabase.from("shops").insert({ ...d, owner_id: user.id }).select("id").single();
    if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
    await supabase.from("profiles").update({ shop_id: shop.id, role: "shop_owner" }).eq("id", user.id);
  }
  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

export async function acceptTermsAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("profiles").update({ accepted_terms_at: new Date().toISOString() }).eq("id", user.id);
  revalidatePath("/settings");
}
