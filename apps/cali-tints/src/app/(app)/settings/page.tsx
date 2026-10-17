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
  // Owner only: the dealerships whose past QuickBooks invoices can be read, and what the last read found (0072).
  const supabase2 = await createClient();
  const [{ data: dealerRows }, { data: history }] = session.canMoney
    ? await Promise.all([supabase2.from("dealerships").select("id, name").eq("retail", false).eq("active", true).order("name"), supabase2.rpc("quickbooks_history_stats")])
    : [{ data: null }, { data: null }];
  const dealerships = dealerRows ?? [];
  return (
    <div className="flex flex-col gap-6">
      <CompanyForm company={session.company} logoUrl={logoUrl} />
      {session.canMoney && <QuickBooksCard company={session.company} configured={quickBooksConfigured()} notice={notice} dealerships={dealerships} history={history} />}
    </div>
  );
}
