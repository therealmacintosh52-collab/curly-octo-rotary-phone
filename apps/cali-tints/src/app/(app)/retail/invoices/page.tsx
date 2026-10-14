import { redirect } from "next/navigation";

/** The invoice is the estimate once the work is done: the unpaid ones are a filter of the Estimates list. */
export default function RetailInvoicesRedirect() {
  redirect("/retail/estimates?stage=unpaid");
}
