import { describe, expect, it } from "vitest";
import { CHECK_CATEGORIES, getCheck, listChecks, phoneClickToCall, registerCheck, type CheckContext } from "./index";

const base = (html: string): CheckContext => ({
  audit: { id: "a" },
  business: { name: "Test Plumbing", canonicalDomain: "testplumbing.example", phone: "(916) 555-0100", address: null },
  website: { pages: [{ url: "https://testplumbing.example/", final_url: "https://testplumbing.example/", status: 200, html }] },
});

describe("check registry", () => {
  it("registers checks under their category prefix", () => {
    expect(getCheck("conversion.phone_click_to_call")).toBe(phoneClickToCall);
    expect(listChecks("conversion")).toContain(phoneClickToCall);
    expect(() => registerCheck({ ...phoneClickToCall, id: "gbp.wrong_prefix", category: "conversion" })).toThrow(/prefixed/);
    expect(() => registerCheck(phoneClickToCall)).toThrow(/Duplicate/);
  });
  it("has one label per category", () => {
    expect(CHECK_CATEGORIES).toHaveLength(16);
  });
});

describe("conversion.phone_click_to_call", () => {
  it("passes when a tel: link exists", async () => {
    expect(await phoneClickToCall.run(base('<header><a href="tel:+19165550100">(916) 555-0100</a></header>'))).toEqual({ status: "pass" });
  });
  it("finds plain-text numbers and cites the page", async () => {
    const out = await phoneClickToCall.run(base("<header>Call (916) 555-0100</header>"));
    expect(out).toMatchObject({ status: "finding", severity: "high", fix_difficulty: "easy" });
    if (out.status === "finding") {
      expect(out.title).toMatch(/cannot be tapped/);
      expect(out.evidence[0]!.source_url).toBe("https://testplumbing.example/");
    }
  });
  it("finds a missing number entirely", async () => {
    const out = await phoneClickToCall.run(base("<main>Welcome</main>"));
    expect(out.status === "finding" && out.title).toMatch(/No tap-to-call/);
  });
  it("is unavailable without a crawled page, never a guess", async () => {
    const ctx = base("");
    delete ctx.website;
    expect(await phoneClickToCall.run(ctx)).toEqual({ status: "unavailable", reason: "home page was not crawled" });
  });
});
