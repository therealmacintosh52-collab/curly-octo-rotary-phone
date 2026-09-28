import type { InvoiceStatus } from "@/lib/db/types";
import { Badge } from "@/components/ui/badge";

const MAP: Record<InvoiceStatus, { label: string; short: string; hint: string; variant: "muted" | "info" | "warning" | "success" | "destructive" }> = {
  draft: { label: "Not sent", short: "Not sent", hint: "Invoice made, not sent to the dealership yet", variant: "muted" },
  submitted: { label: "Sent to dealer", short: "Sent", hint: "Emailed or handed to the dealership; waiting on their payment", variant: "info" },
  partial: { label: "Partially paid", short: "Partial", hint: "Some money received, balance still due", variant: "warning" },
  paid: { label: "Paid", short: "Paid", hint: "Paid in full", variant: "success" },
  void: { label: "Void", short: "Void", hint: "Cancelled; nothing billed", variant: "destructive" },
};
const OVERDUE_HINT = "Unpaid past the payment terms";
const DELETED = { label: "Deleted", hint: "Deleted · kept in the archive, can be restored" };

/** Status in the owner's words: has it been sent, is it paid. `short` fits a table cell; overdue replaces the label rather than stacking. Hover or long-press for what it means. */
export function InvoiceStatusBadge({ status, overdue, short, deleted }: { status: InvoiceStatus; overdue?: boolean; short?: boolean; deleted?: boolean }) {
  const m = deleted ? { ...MAP.void, ...DELETED, short: DELETED.label } : MAP[status];
  if (overdue && short)
    return (
      <Badge variant="destructive" title={OVERDUE_HINT}>
        Overdue
      </Badge>
    );
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant={m.variant} title={m.hint}>
        {short ? m.short : m.label}
      </Badge>
      {overdue && (
        <Badge variant="destructive" title={OVERDUE_HINT}>
          Overdue
        </Badge>
      )}
    </span>
  );
}
