import { redirect } from "next/navigation";
import { AppHeader } from "@/components/shell/app-header";
import { BottomNav, SideNav } from "@/components/shell/bottom-nav";
import { getEntitlements } from "@/lib/entitlements";
import { getProfile } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const ent = await getEntitlements(profile);
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader displayName={profile.display_name} tier={ent.tier} />
      <div className="flex flex-1">
        <SideNav />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
