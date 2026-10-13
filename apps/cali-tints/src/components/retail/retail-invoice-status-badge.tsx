import type { RetailInvoiceStatus } from "@/lib/db/types";
import { Badge } from "@/components/ui/badge";

export const RETAIL_INVOICE_STATUS: Record<RetailInvoiceStatus, { label: string; hint: string; variant: "warning" | "info" | "success" | "outline" }> = {
  unpaid: { label: "Unpaid", hint: "Nothing received yet", variant: "warning" },
  partial: { label: "Part paid", hint: "A deposit or part of the bill is in", variant: "info" },
  paid: { label: "Paid", hint: "Paid at the counter", variant: "success" },
  void: { label: "Void", hint: "The repair order was deleted", variant: "outline" },
};

export function RetailInvoiceStatusBadge({ status }: { status: RetailInvoiceStatus }) {
  const m = RETAIL_INVOICE_STATUS[status];
  return (
    <Badge variant={m.variant} title={m.hint} data-status={status}>
      {m.label}
    </Badge>
  );
}
