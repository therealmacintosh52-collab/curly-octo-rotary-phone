import type { Metadata } from "next";
import { requireOwnerAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CompanyForm } from "@/components/settings/company-form";

export const metadata: Metadata = { title: "Company settings" };

export default async function CompanySettingsPage() {
  const session = await requireOwnerAdmin();
  let logoUrl: string | null = null;
  if (session.company.logo_path) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("logos").createSignedUrl(session.company.logo_path, 3600);
    logoUrl = data?.signedUrl ?? null;
  }
  return (
    <div className="flex flex-col gap-6">
      <CompanyForm company={session.company} logoUrl={logoUrl} />
    </div>
  );
}
