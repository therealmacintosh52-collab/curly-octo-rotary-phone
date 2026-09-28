import { Page, PageHeader } from "@/components/app/page-header";
import { NewAuditForm } from "@/app/admin/audits/new/new-audit-form";

export default function PreviewNewAudit() {
  return (
    <Page narrow>
      <PageHeader title="New audit" eyebrow="Audits" description="Paste what you have. One input is enough; more inputs mean a stronger cross-check." />
      <div className="mt-6">
        <NewAuditForm />
      </div>
    </Page>
  );
}
