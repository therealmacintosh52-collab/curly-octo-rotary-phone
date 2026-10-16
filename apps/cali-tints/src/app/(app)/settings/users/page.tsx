import type { Metadata } from "next";
import { requireOwnerAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UsersManager } from "@/components/settings/users-manager";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const session = await requireOwnerAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").order("active", { ascending: false }).order("role").order("full_name");
  // Only the owner sees who has an approval PIN and can reset one (0070).
  const { data: holders } = session.profile.role === "owner" ? await supabase.rpc("pin_holders") : { data: null };
  return <UsersManager users={data ?? []} pinHolders={holders ?? null} currentUserId={session.userId} currentRole={session.profile.role} emailConfigured={!!process.env.SUPABASE_SERVICE_ROLE_KEY} />;
}
