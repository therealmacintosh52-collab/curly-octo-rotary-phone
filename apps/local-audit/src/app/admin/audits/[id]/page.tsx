import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuditDetail } from "@/components/audits/audit-detail";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit" };
export const dynamic = "force-dynamic";

export default async function AuditDetailPage(props: PageProps<"/admin/audits/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: audit } = await supabase.from("audits").select("*").eq("id", id).maybeSingle();
  if (!audit) notFound();
  const [{ data: business }, { data: findings }, { data: evidence }] = await Promise.all([
    supabase.from("businesses").select("*").eq("id", audit.business_id).maybeSingle(),
    supabase.from("findings").select("*").eq("audit_id", id).order("severity").order("impact_score", { ascending: false }),
    supabase.from("evidence").select("*").eq("audit_id", id).order("captured_at"),
  ]);
  return <AuditDetail audit={audit} business={business ?? null} findings={findings ?? []} evidence={evidence ?? []} />;
}
