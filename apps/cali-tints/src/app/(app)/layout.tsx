import { getSession } from "@/lib/auth";
import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { FirstSignIn } from "@/components/guide/first-sign-in";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>{children}</AppShell>
        <FirstSignIn seen={!!session.profile.guide_seen_at} />
        <InstallPrompt />
      </SyncProvider>
    </SessionProvider>
  );
}
