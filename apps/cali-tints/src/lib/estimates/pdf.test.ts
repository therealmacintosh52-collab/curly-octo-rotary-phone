import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { ESTIMATE_IDS, estimatePublicFixture, ESTIMATE_TOKEN, estimateViewFixture } from "@/test/retail-fixtures";
import { estimatePdf } from "./pdf";
import { estimateFileStem } from "./load";

const OUT = process.env.RENDER_OUT_DIR;
// A 1×1 transparent PNG stands in for the customer's signature.
const SIG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("estimate pdf", () => {
  it("renders a sent estimate with three options", async () => {
    const e = estimateViewFixture(ESTIMATE_IDS.ana, true)!;
    const buf = await estimatePdf(e, null, null);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(5000);
    expect(estimateFileStem(e)).toBe("EST-000001-ana-lopez");
    if (OUT) writeFileSync(`${OUT}/estimate-sent.pdf`, buf);
  });

  it("lists what the tech found (visible ones only) on the estimate", async () => {
    const e = estimateViewFixture(ESTIMATE_IDS.ana, true)!;
    expect(e.findings).toHaveLength(3); // staff see the internal note too
    const withFindings = await estimatePdf(e, null, null);
    const without = await estimatePdf({ ...e, findings: [] }, null, null);
    expect(withFindings.length).toBeGreaterThan(without.length);
    // the customer's copy has no internal note
    expect(estimatePublicFixture(ESTIMATE_TOKEN)!.findings).toHaveLength(2);
  });

  it("renders an approved estimate with the signature", async () => {
    const e = estimateViewFixture(ESTIMATE_IDS.luis, true)!;
    const buf = await estimatePdf(e, null, SIG);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    if (OUT) writeFileSync(`${OUT}/estimate-approved.pdf`, buf);
  });

  it("renders the customer's copy (first name only, prices present)", async () => {
    const e = estimatePublicFixture(ESTIMATE_TOKEN)!;
    expect(e.customer.phone).toBeNull();
    expect(e.internal_notes).toBeNull();
    expect(e.options[1].total).toBe(270);
    const buf = await estimatePdf(e, null, null);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
