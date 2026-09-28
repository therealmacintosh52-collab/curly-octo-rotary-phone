import type { Metadata } from "next";
import { Page, PageHeader } from "@/components/app/page-header";
import { NewAuditForm } from "./new-audit-form";

export const metadata: Metadata = { title: "New audit" };

export default function NewAuditPage() {
  return (
    <Page narrow>
      <PageHeader title="New audit" eyebrow="Audits" description="Paste what you have. One input is enough; more inputs mean a stronger cross-check." />
      <div className="mt-6">
        <NewAuditForm />
      </div>
    </Page>
  );
}
