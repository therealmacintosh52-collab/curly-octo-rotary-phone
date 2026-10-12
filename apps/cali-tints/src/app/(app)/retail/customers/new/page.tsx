import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Page, PageHeader } from "@/components/app/page-header";
import { CustomerForm } from "@/components/retail/customer-form";

export const metadata: Metadata = { title: "New customer" };

export default function NewCustomerPage() {
  return (
    <Page narrow>
      <Link href="/retail/customers" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Customers
      </Link>
      <PageHeader title="New customer" description="Name and phone are enough to start. Consents are asked, never assumed." />
      <div className="mt-5">
        <CustomerForm />
      </div>
    </Page>
  );
}
