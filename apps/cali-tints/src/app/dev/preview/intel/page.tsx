import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { IntelNav } from "@/components/intel/intel-nav";
import { CodesScreen } from "@/components/intel/codes-screen";
import { codesScreenFixture } from "@/test/intel-fixtures";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of Intel → Codes (guest demo in production). */
export default async function DevIntelPreview(props: PageProps<"/dev/preview/intel">) {
  const sp = await props.searchParams;
  const { session } = previewSession(sp);
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <IntelNav />
          </div>
          <CodesScreen data={codesScreenFixture(sp)} />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
