import { redirect } from "next/navigation";

/** Fixture twin of the Work list: retail has no jobs, so it goes to the Estimates list. */
export default function DevRetailWorkRedirect() {
  redirect("/retail/estimates?stage=open");
}
