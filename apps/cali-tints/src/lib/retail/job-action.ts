/**
 * The one button at the bottom of a retail job. It says what happens next and
 * changes with the stage, so nobody hunts for the step: finish the work, sign
 * it off, convert to the invoice, collect payment, customer signs, and the
 * last one: Close job · Picked up.
 */
export type JobActionKey = "complete" | "qc" | "convert" | "collect" | "sign" | "close" | "closed" | "send" | "waiting" | "apply" | "makeinvoice" | "startro";

export type JobActionInput = {
  deleted?: boolean;
  completed: boolean;
  qc: boolean;
  invoiced: boolean;
  paid: boolean;
  /** The customer has signed the receipt (after paying). */
  signed: boolean;
  signatureRequired: boolean;
  pickedUp: boolean;
  /** Lines nothing authorizes yet (blocks the invoice). */
  unauthorized?: number;
  /** Who is looking. */
  canComplete: boolean;
  canQc: boolean;
  canPrice: boolean;
};

export type JobAction = { key: JobActionKey; label: string; enabled: boolean; hint: string | null } | null;

export function nextJobAction(i: JobActionInput): JobAction {
  if (i.deleted) return null;
  if (i.pickedUp) return { key: "closed", label: "Closed", enabled: false, hint: null };
  if (i.paid) {
    if (i.signatureRequired && !i.signed) return { key: "sign", label: "Customer signs", enabled: i.canPrice, hint: i.canPrice ? "They paid. Now the customer signs for the car." : "Waiting for the advisor to take the signature." };
    return { key: "close", label: "Close Job", enabled: i.canPrice, hint: i.canPrice ? "Paid and signed. Hand over the keys." : "Waiting for the advisor to close the job." };
  }
  if (i.invoiced) return { key: "collect", label: "Collect payment", enabled: i.canPrice, hint: i.canPrice ? null : "Waiting for the advisor to take payment." };
  if (!i.completed) return { key: "complete", label: "Mark the work done", enabled: i.canComplete, hint: i.canComplete ? null : "The tech marks the work done." };
  if (!i.qc) return { key: "qc", label: "Sign off the work", enabled: i.canQc, hint: i.canQc ? null : "Waiting for the advisor or owner to check the work." };
  return { key: "convert", label: "Convert to invoice", enabled: i.canPrice && (i.unauthorized ?? 0) === 0, hint: (i.unauthorized ?? 0) > 0 ? "Some work is not authorized yet." : i.canPrice ? null : "Waiting for the advisor to invoice." };
}
