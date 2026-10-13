import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { IntelNav } from "@/components/intel/intel-nav";
import { FixesScreen } from "@/components/intel/fixes-screen";
import { fixesListFixture } from "@/test/intel-fixtures";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of Intel → Fixes (guest demo in production). */
export default async function DevIntelFixesPreview(props: PageProps<"/dev/preview/intel/fixes">) {
  const sp = await props.searchParams;
  const { session } = previewSession(sp);
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <IntelNav />
          </div>
          <FixesScreen fixes={fixesListFixture(sp)} q={typeof sp.q === "string" ? sp.q : ""} codes={typeof sp.codes === "string" ? sp.codes : ""} mine={sp.mine === "1"} />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
