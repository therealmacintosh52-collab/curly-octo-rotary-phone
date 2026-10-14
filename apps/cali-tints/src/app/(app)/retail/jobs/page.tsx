import { redirect } from "next/navigation";

/** Retail has no jobs: every visit is an estimate that becomes the invoice. The old Work list is the Estimates list. */
export default function RetailWorkRedirect() {
  redirect("/retail/estimates?stage=open");
}
