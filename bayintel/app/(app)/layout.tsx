import { redirect } from "next/navigation";
import { AppHeader } from "@/components/shell/app-header";
import { BottomNav, SideNav } from "@/components/shell/bottom-nav";
import { getEntitlements } from "@/lib/entitlements";
import { getProfile, getUser } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const profile = await getProfile();
  if (!profile) {
    // Signed in but no profile row could be read or created: show the problem instead of redirect-looping.
    return (
      <main className="mx-auto max-w-md p-6 text-sm">
        <h1 className="text-lg font-semibold">Account setup incomplete</h1>
        <p className="mt-2 text-muted-foreground">Your profile row is missing and could not be created. Run the migrations (the auth trigger creates profiles) or contact support.</p>
        <form action="/auth/signout" method="post" className="mt-4">
          <button className="h-12 w-full rounded-lg border border-border">Sign out</button>
        </form>
      </main>
    );
  }
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
