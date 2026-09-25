import { getSession } from "@/lib/auth";
import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>{children}</AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
