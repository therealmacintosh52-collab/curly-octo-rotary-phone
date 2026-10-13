import { notFound } from "next/navigation";
import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { IntelNav } from "@/components/intel/intel-nav";
import { FixForm } from "@/components/intel/fix-form";
import { fixDetailFixture, garageRowsFixture } from "@/test/intel-fixtures";
import { fixToInitial } from "@/lib/intel/fixes";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of editing a fix (guest demo in production). */
export default async function DevIntelEditFixPreview(props: PageProps<"/dev/preview/intel/fixes/[id]/edit">) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const { session, canPrices } = previewSession(sp);
  const fix = fixDetailFixture(id, canPrices);
  if (!fix) notFound();
  const vehicles = garageRowsFixture().filter((r) => r.year && r.make && r.model).map((r) => ({ id: r.id, year: r.year!, make: r.make!, model: r.model!, engine: r.engine, label: `${r.year} ${r.make} ${r.model}` }));
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <IntelNav />
          </div>
          <FixForm vehicles={vehicles} initial={fixToInitial(fix)} fix={fix} />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
