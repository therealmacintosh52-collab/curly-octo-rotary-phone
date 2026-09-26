import type { InvoiceStatus } from "@/lib/db/types";
import { Badge } from "@/components/ui/badge";

const MAP: Record<InvoiceStatus, { label: string; variant: "muted" | "info" | "warning" | "success" | "destructive" }> = {
  draft: { label: "Draft", variant: "muted" },
  submitted: { label: "Submitted", variant: "info" },
  partial: { label: "Partially paid", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
  void: { label: "Void", variant: "destructive" },
};

export function InvoiceStatusBadge({ status, overdue }: { status: InvoiceStatus; overdue?: boolean }) {
  const m = MAP[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant={m.variant}>{m.label}</Badge>
      {overdue && <Badge variant="destructive">Overdue</Badge>}
    </span>
  );
}
