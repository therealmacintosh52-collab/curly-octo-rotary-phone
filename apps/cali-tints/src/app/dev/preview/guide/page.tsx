import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { Guide } from "@/components/guide/guide";
import { Segmented } from "@/components/ui/segmented";
import type { Profile, UserRole } from "@/lib/db/types";
import { invoiceBundleFixture } from "@/test/fixtures";

const ROLES: { value: UserRole; label: string; name: string }[] = [
  { value: "owner", label: "Owner", name: "Mike" },
  { value: "manager", label: "Manager", name: "Victor" },
  { value: "detailer", label: "Detailer", name: "Sam" },
];

/** Dev-only guide with a role picker (guest preview in production). */
export default async function DevGuidePreview(props: PageProps<"/dev/preview/guide">) {
  const sp = await props.searchParams;
  const { company } = invoiceBundleFixture();
  const role = (ROLES.find((r) => r.value === sp.role)?.value ?? "owner") as UserRole;
  const who = ROLES.find((r) => r.value === role)!;
  const profile = { id: "u1", company_id: company.id, role, full_name: who.name, email: null, active: true, guide_seen_at: null } as Profile;
  return (
    <SessionProvider value={{ userId: profile.id, email: null, profile, company, isAdmin: role !== "detailer", demo: true }}>
      <SyncProvider>
        <AppShell>
          <Guide role={role} name={who.name} welcome={sp.welcome === "1"} roleSwitcher={<Segmented aria-label="See it as" size="sm" items={ROLES.map((r) => ({ value: r.value, label: r.label, href: `/guide?role=${r.value}` }))} value={role} />} />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
