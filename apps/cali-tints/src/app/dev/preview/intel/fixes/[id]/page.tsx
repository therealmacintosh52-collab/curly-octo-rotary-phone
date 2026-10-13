import { notFound } from "next/navigation";
import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { IntelNav } from "@/components/intel/intel-nav";
import { FixDetailView } from "@/components/intel/fix-detail-view";
import { fixDetailFixture } from "@/test/intel-fixtures";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of one fix (guest demo in production). */
export default async function DevIntelFixPreview(props: PageProps<"/dev/preview/intel/fixes/[id]">) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const { session, canPrices } = previewSession(sp);
  const fix = fixDetailFixture(id, canPrices);
  if (!fix) notFound();
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <IntelNav />
          </div>
          <FixDetailView fix={fix} />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
