import { requireAdmin } from "@/lib/auth";
import { SessionProvider } from "@/components/app/session-provider";
import { AppShell } from "@/components/app/app-shell";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await requireAdmin();
  return (
    <SessionProvider value={session}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
