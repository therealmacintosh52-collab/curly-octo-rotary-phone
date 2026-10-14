import { describe, expect, it } from "vitest";
import { nextJobAction, type JobActionInput } from "./job-action";

const base: JobActionInput = { completed: false, qc: false, invoiced: false, paid: false, signed: false, signatureRequired: true, pickedUp: false, canComplete: true, canQc: true, canPrice: true };

describe("the button at the bottom of a job", () => {
  it("walks the stages in order", () => {
    expect(nextJobAction(base)?.key).toBe("complete");
    expect(nextJobAction({ ...base, completed: true })?.key).toBe("qc");
    expect(nextJobAction({ ...base, completed: true, qc: true })?.key).toBe("convert");
    expect(nextJobAction({ ...base, completed: true, qc: true, invoiced: true })?.key).toBe("collect");
    expect(nextJobAction({ ...base, invoiced: true, paid: true })?.key).toBe("sign");
    const close = nextJobAction({ ...base, invoiced: true, paid: true, signed: true });
    expect(close?.key).toBe("close");
    expect(close?.label).toBe("Close job · Picked up");
    expect(nextJobAction({ ...base, invoiced: true, paid: true, signed: true, pickedUp: true })?.key).toBe("closed");
  });

  it("skips the signature step when the shop does not require it", () => {
    expect(nextJobAction({ ...base, invoiced: true, paid: true, signatureRequired: false })?.key).toBe("close");
  });

  it("is switched off for people who may not take that step, and while work is not authorized", () => {
    expect(nextJobAction({ ...base, canComplete: false })?.enabled).toBe(false);
    expect(nextJobAction({ ...base, completed: true, qc: true, unauthorized: 1 })?.enabled).toBe(false);
    expect(nextJobAction({ ...base, invoiced: true, paid: true, signed: true, canPrice: false })?.enabled).toBe(false);
  });

  it("shows nothing on a deleted job", () => {
    expect(nextJobAction({ ...base, deleted: true })).toBeNull();
  });
});
