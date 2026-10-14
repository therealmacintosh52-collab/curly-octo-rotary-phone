import { redirect } from "next/navigation";

/** Fixture twin of the invoices list: the unpaid ones are a filter of the Estimates list. */
export default function DevRetailInvoicesRedirect() {
  redirect("/retail/estimates?stage=unpaid");
}
