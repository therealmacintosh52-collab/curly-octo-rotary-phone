import { describe, expect, it } from "vitest";
import type { UserRole } from "@/lib/db/types";
import { canManageSettings, canPriceJobs, canSeeMoney, isAdvisor, isCompanyWide, isOwner, isOwnerAdmin } from "./roles";
import { previewSession } from "@/test/preview-session";

const ROLES: UserRole[] = ["owner", "admin", "advisor", "manager", "detailer"];

describe("roles", () => {
  it("gives each role exactly its rights", () => {
    const table = ROLES.map((r) => [r, isOwner(r), canSeeMoney(r), isOwnerAdmin(r), canManageSettings(r), isCompanyWide(r), canPriceJobs(r), isAdvisor(r)]);
    expect(table).toEqual([
      ["owner", true, true, true, true, true, true, false],
      ["admin", false, false, true, true, true, true, false],
      ["advisor", false, false, false, false, true, true, true],
      ["manager", false, false, false, false, true, false, false],
      ["detailer", false, false, false, false, false, false, false],
    ]);
  });

  it("previews the advisor with estimate money and no Settings", () => {
    const s = previewSession({ as: "advisor" });
    expect(s.profile.role).toBe("advisor");
    expect(s.session).toMatchObject({ isAdmin: true, canSettings: false, canMoney: false, canPrices: true });
    expect(previewSession({ as: "team" }).session).toMatchObject({ isAdmin: true, canSettings: true, canMoney: false, canPrices: true });
    expect(previewSession({}).session).toMatchObject({ canSettings: true, canMoney: true });
  });
});
