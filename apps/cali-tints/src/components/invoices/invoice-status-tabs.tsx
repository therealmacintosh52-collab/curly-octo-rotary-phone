"use client";

import { Segmented } from "@/components/ui/segmented";

const ITEMS = [
  { value: "all", label: "Open", href: "/invoices" },
  { value: "outstanding", label: "Outstanding", href: "/invoices?status=outstanding" },
  { value: "overdue", label: "Overdue", href: "/invoices?status=overdue" },
  { value: "draft", label: "Draft", href: "/invoices?status=draft" },
  { value: "submitted", label: "Submitted", href: "/invoices?status=submitted" },
  { value: "partial", label: "Partial", href: "/invoices?status=partial" },
  { value: "paid", label: "Paid", href: "/invoices?status=paid" },
  { value: "void", label: "Void", href: "/invoices?status=void" },
];

export function InvoiceStatusTabs({ value }: { value: string }) {
  return <Segmented aria-label="Invoice status" items={ITEMS} value={value} className="w-full sm:w-auto" />;
}
