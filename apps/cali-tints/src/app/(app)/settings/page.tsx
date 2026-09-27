import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CompanyForm } from "@/components/settings/company-form";
import { CloverCard } from "@/components/settings/clover-card";
import { cloverEnvStatus } from "@/lib/clover/env";
import { cloverStatus } from "@/lib/clover/status";
import { CloverSetupChecklist, cloverSetupSteps } from "@/components/clover/setup-checklist";

export const metadata: Metadata = { title: "Company settings" };

export default async function CompanySettingsPage(props: PageProps<"/settings">) {
  const session = await requireAdmin();
  const sp = await props.searchParams;
  const notice = sp.clover === "connected" ? { kind: "connected" as const, message: typeof sp.name === "string" ? sp.name : null } : sp.clover === "error" ? { kind: "error" as const, message: typeof sp.msg === "string" ? sp.msg : null } : null;
  const status = await cloverStatus(session.company);
  let logoUrl: string | null = null;
  if (session.company.logo_path) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("logos").createSignedUrl(session.company.logo_path, 3600);
    logoUrl = data?.signedUrl ?? null;
  }
  return (
    <div className="flex flex-col gap-6">
      <CompanyForm company={session.company} logoUrl={logoUrl} />
      <CloverSetupChecklist steps={cloverSetupSteps(session.company, status, process.env.NEXT_PUBLIC_APP_URL ?? null)} />
      <CloverCard company={session.company} envStatus={cloverEnvStatus()} status={status} notice={notice} />
    </div>
  );
}
