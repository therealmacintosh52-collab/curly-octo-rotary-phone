import type { Profile } from "@/lib/db/types";
import { invoiceBundleFixture } from "@/test/fixtures";

/** The fixture session behind a preview page: `?as=team` is an admin (Manny), `?as=advisor` is Alex, `?as=detailer` is Sam, otherwise the owner (Mike). */
export function previewSession(sp: Record<string, string | string[] | undefined>) {
  const { company } = invoiceBundleFixture();
  const asDetailer = sp.as === "detailer";
  const asTeam = sp.as === "team";
  const asAdvisor = sp.as === "advisor";
  const profile = (asDetailer
    ? { id: "u5", company_id: company.id, role: "detailer", full_name: "Sam", email: null, active: true }
    : asTeam
      ? { id: "u4", company_id: company.id, role: "admin", full_name: "Manny", email: null, active: true }
      : asAdvisor
        ? { id: "u6", company_id: company.id, role: "advisor", full_name: "Alex", email: null, active: true }
        : { id: "u1", company_id: company.id, role: "owner", full_name: "Mike", email: null, active: true }) as Profile;
  const isAdmin = !asDetailer;
  const canMoney = !asDetailer && !asTeam && !asAdvisor;
  const canSettings = !asDetailer && !asAdvisor;
  const canPrices = isAdmin;
  return { company, profile, isAdmin, canMoney, canPrices, canSettings, session: { userId: profile.id, email: null, profile, company, isAdmin, canSettings, canMoney, canPrices, demo: true as const } };
}
