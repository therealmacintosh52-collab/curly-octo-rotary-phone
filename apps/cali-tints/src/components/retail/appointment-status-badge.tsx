import type { AppointmentStatus } from "@/lib/db/types";
import { Badge } from "@/components/ui/badge";

export const APPOINTMENT_STATUS: Record<AppointmentStatus, { label: string; hint: string; variant: "muted" | "info" | "warning" | "success" | "destructive" | "outline" | "default" }> = {
  hold: { label: "Holding", hint: "A customer is booking online; the spot is held for a few minutes", variant: "outline" },
  lead: { label: "Lead · confirm", hint: "Booked online without a deposit; confirm it or call them", variant: "warning" },
  booked: { label: "Booked", hint: "On the calendar", variant: "info" },
  confirmed: { label: "Confirmed", hint: "The customer confirmed they are coming", variant: "info" },
  in_progress: { label: "In the shop", hint: "Checked in", variant: "default" },
  done: { label: "Done", hint: "Finished", variant: "success" },
  cancelled: { label: "Cancelled", hint: "Cancelled", variant: "destructive" },
  no_show: { label: "No-show", hint: "They did not come", variant: "destructive" },
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const m = APPOINTMENT_STATUS[status];
  return (
    <Badge variant={m.variant} title={m.hint} data-status={status}>
      {m.label}
    </Badge>
  );
}
