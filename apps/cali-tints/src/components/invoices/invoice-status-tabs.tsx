"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function InvoiceStatusTabs({ value }: { value: string }) {
  const router = useRouter();
  return (
    <Tabs value={value} onValueChange={(v) => router.push(v === "all" ? "/invoices" : `/invoices?status=${v}`)}>
      <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
        <TabsTrigger value="all">Open</TabsTrigger>
        <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
        <TabsTrigger value="overdue">Overdue</TabsTrigger>
        <TabsTrigger value="draft">Draft</TabsTrigger>
        <TabsTrigger value="submitted">Submitted</TabsTrigger>
        <TabsTrigger value="partial">Partial</TabsTrigger>
        <TabsTrigger value="paid">Paid</TabsTrigger>
        <TabsTrigger value="void">Void</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
