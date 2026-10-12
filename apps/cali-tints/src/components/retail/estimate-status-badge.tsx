import type { EstimateStatus } from "@/lib/db/types";
import { Badge } from "@/components/ui/badge";

export const ESTIMATE_STATUS: Record<EstimateStatus, { label: string; hint: string; variant: "muted" | "info" | "warning" | "success" | "destructive" | "outline" }> = {
  draft: { label: "Draft", hint: "Not sent to the customer yet", variant: "muted" },
  sent: { label: "Sent", hint: "The link went out; they have not opened it", variant: "info" },
  viewed: { label: "Viewed", hint: "They opened the link; no answer yet", variant: "warning" },
  accepted: { label: "Approved", hint: "Approved and signed", variant: "success" },
  declined: { label: "Declined", hint: "They said no", variant: "destructive" },
  expired: { label: "Expired", hint: "Past its date without an answer", variant: "outline" },
};

export function EstimateStatusBadge({ status }: { status: EstimateStatus }) {
  const m = ESTIMATE_STATUS[status];
  return (
    <Badge variant={m.variant} title={m.hint} data-status={status}>
      {m.label}
    </Badge>
  );
}
