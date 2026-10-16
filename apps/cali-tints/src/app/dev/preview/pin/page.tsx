import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { Page, PageHeader } from "@/components/app/page-header";
import { MyPinCard } from "@/components/jobs/my-pin-card";
import type { Profile, UserRole } from "@/lib/db/types";
import { invoiceBundleFixture } from "@/test/fixtures";

/** Guest preview of the approval PIN screen (?as=manager|owner|admin|detailer). */
export default async function DevPinPreview(props: PageProps<"/dev/preview/pin">) {
  const sp = await props.searchParams;
  const { company } = invoiceBundleFixture();
  const role = (["owner", "admin", "manager", "detailer"].includes(String(sp.as)) ? sp.as : "manager") as UserRole;
  const profile = { id: "u1", company_id: company.id, role, full_name: role === "manager" ? "Victor" : "Mike", email: null, active: true, guide_seen_at: null } as Profile;
  return (
    <SessionProvider value={{ userId: profile.id, email: null, profile, company, isAdmin: role !== "detailer", canSettings: role === "owner" || role === "admin", canMoney: role === "owner", canPrices: role === "owner" || role === "admin", demo: true }}>
      <SyncProvider>
        <AppShell>
          <Page narrow>
            <PageHeader title="Approval PIN" description="A detailer needs a manager's PIN to edit or delete a job. You type yours on their phone." />
            <div className="mt-5">
              <MyPinCard canHavePin={role !== "detailer"} hasPin={false} setAt={null} />
            </div>
          </Page>
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
