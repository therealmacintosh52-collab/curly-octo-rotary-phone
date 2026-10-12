import { describe, expect, it } from "vitest";
import { receiptFixture, RECEIPT_TOKEN } from "@/test/retail-fixtures";
import { receiptPdf } from "./pdf";
import { receiptFileStem } from "./load";

const SIG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("receipt pdf", () => {
  it("renders the paid job with its deposit, balance and signature", async () => {
    const r = receiptFixture(RECEIPT_TOKEN, true)!;
    expect(r.total).toBe(240);
    expect(r.deposit_paid).toBe(48);
    expect(r.balance).toBe(0);
    const buf = await receiptPdf(r, null, SIG);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(receiptFileStem(r)).toBe("receipt-r-101-ana-lopez");
  });
});
