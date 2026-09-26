import { requireAdmin } from "@/lib/auth";
import { Page, PageHeader } from "@/components/app/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";

export default async function SettingsLayout({ children }: LayoutProps<"/settings">) {
  await requireAdmin();
  return (
    <Page>
      <PageHeader title="Settings" description="Company profile, dealerships, price list, users and data export." />
      <div className="mt-5">
        <SettingsNav />
      </div>
      <div className="mt-5">{children}</div>
    </Page>
  );
}
