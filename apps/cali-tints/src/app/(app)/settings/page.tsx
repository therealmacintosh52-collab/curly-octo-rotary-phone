import type { Metadata } from "next";
import { requireOwnerAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { quickBooksConfigured } from "@/lib/quickbooks/env";
import { CompanyForm } from "@/components/settings/company-form";
import { QuickBooksCard, type QuickBooksNotice } from "@/components/settings/quickbooks-card";

export const metadata: Metadata = { title: "Company settings" };

export default async function CompanySettingsPage(props: PageProps<"/settings">) {
  const session = await requireOwnerAdmin();
  const sp = await props.searchParams;
  let logoUrl: string | null = null;
  if (session.company.logo_path) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("logos").createSignedUrl(session.company.logo_path, 3600);
    logoUrl = data?.signedUrl ?? null;
  }
  // Coming back from Intuit: /settings?quickbooks=connected&name=…&pushed=N or ?quickbooks=error&msg=…
  const notice: QuickBooksNotice | null =
    sp.quickbooks === "connected"
      ? { kind: "connected", message: typeof sp.name === "string" ? sp.name : null, pushed: typeof sp.pushed === "string" ? Number(sp.pushed) || 0 : 0 }
      : sp.quickbooks === "error"
        ? { kind: "error", message: typeof sp.msg === "string" ? sp.msg : null }
        : null;
  return (
    <div className="flex flex-col gap-6">
      <CompanyForm company={session.company} logoUrl={logoUrl} />
      {session.canMoney && <QuickBooksCard company={session.company} configured={quickBooksConfigured()} notice={notice} />}
    </div>
  );
}
