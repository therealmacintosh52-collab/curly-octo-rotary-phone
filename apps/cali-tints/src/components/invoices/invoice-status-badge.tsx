import type { InvoiceStatus } from "@/lib/db/types";
import { Badge } from "@/components/ui/badge";

const MAP: Record<InvoiceStatus, { label: string; short: string; variant: "muted" | "info" | "warning" | "success" | "destructive" }> = {
  draft: { label: "Not sent", short: "Not sent", variant: "muted" },
  submitted: { label: "Sent", short: "Sent", variant: "info" },
  partial: { label: "Partially paid", short: "Partial", variant: "warning" },
  paid: { label: "Paid", short: "Paid", variant: "success" },
  void: { label: "Void", short: "Void", variant: "destructive" },
};

/** Status in the owner's words: has it been sent, is it paid. `short` fits a table cell; overdue replaces the label rather than stacking. */
export function InvoiceStatusBadge({ status, overdue, short }: { status: InvoiceStatus; overdue?: boolean; short?: boolean }) {
  const m = MAP[status];
  if (overdue && short) return <Badge variant="destructive">Overdue</Badge>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant={m.variant}>{short ? m.short : m.label}</Badge>
      {overdue && <Badge variant="destructive">Overdue</Badge>}
    </span>
  );
}
