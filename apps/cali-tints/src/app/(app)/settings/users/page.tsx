import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UsersManager } from "@/components/settings/users-manager";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const session = await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").order("active", { ascending: false }).order("role").order("full_name");
  return <UsersManager users={data ?? []} currentUserId={session.userId} currentRole={session.profile.role} emailConfigured={!!process.env.SUPABASE_SERVICE_ROLE_KEY} />;
}
