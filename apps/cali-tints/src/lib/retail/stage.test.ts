import { describe, expect, it } from "vitest";
import { roStage } from "./stage";

describe("roStage", () => {
  it("is an estimate until the customer approves something", () => {
    expect(roStage({ hasJob: false, estimateStatus: "draft" })).toMatchObject({ key: "estimate", index: 0, sub: "Being written" });
    expect(roStage({ hasJob: false, estimateStatus: "sent" }).sub).toBe("Waiting on the customer");
    expect(roStage({ hasJob: false, estimateStatus: "viewed" }).sub).toBe("Waiting on the customer");
    expect(roStage({ hasJob: false, estimateStatus: "declined" }).sub).toBe("Declined");
    expect(roStage({ hasJob: false, estimateStatus: "expired" }).sub).toBe("Expired");
  });
  it("is work in progress once the repair order has approved work, until it is converted", () => {
    expect(roStage({ hasJob: true, lineCount: 2 })).toMatchObject({ key: "in_progress", index: 1, sub: "Work approved" });
    expect(roStage({ hasJob: true, lineCount: 2, waitingOnApproval: true }).sub).toBe("Waiting on approval");
  });
  it("a checked-in car with nothing approved yet is still being inspected", () => {
    expect(roStage({ hasJob: true, lineCount: 0 })).toMatchObject({ key: "estimate", sub: "Inspecting" });
    expect(roStage({ hasJob: true, lineCount: 0, waitingOnApproval: true }).sub).toBe("Waiting on approval");
  });
  it("is an invoice once converted, and closed once paid", () => {
    expect(roStage({ hasJob: true, lineCount: 3, invoicedAt: "2026-10-14T10:00:00Z" })).toMatchObject({ key: "invoice", index: 2, sub: "Waiting on payment" });
    expect(roStage({ hasJob: true, lineCount: 3, invoicedAt: "2026-10-14T10:00:00Z", paidAt: "2026-10-14T12:00:00Z" })).toMatchObject({ key: "closed", index: 3 });
  });
  it("a paid job that was never converted is not closed (payments wait for the invoice)", () => {
    expect(roStage({ hasJob: true, lineCount: 1, paidAt: "2026-10-14T12:00:00Z" }).key).toBe("in_progress");
  });
});
