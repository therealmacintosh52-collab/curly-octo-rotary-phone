import { describe, expect, it } from "vitest";
import { ESTIMATE_IDS, estimateViewFixture } from "@/test/retail-fixtures";
import { keyTagFields, oilStickerFields, oilStickerOptions } from "./fields";
import { keyTagPdf, oilStickerPdf } from "./pdf";

describe("labels", () => {
  const e = estimateViewFixture(ESTIMATE_IDS.ana, true)!;

  it("a key tag shows the number, the car and plate, the customer as first name + last initial, staff as initials", () => {
    const f = keyTagFields(e);
    expect(f.number).toBeTruthy();
    expect(f.car).toMatch(/\d{4}/);
    expect(f.customer).toMatch(/^[A-Za-z]+ [A-Z]\.$/);
    expect(f.advisor === null || f.advisor.length <= 3).toBe(true);
    expect(JSON.stringify(f)).not.toContain("@");
  });

  it("an oil sticker adds the interval to the mileage and the months to today", () => {
    const f = oilStickerFields({ ...e, odometer: 48000, job: null }, { intervalMiles: 5000, intervalMonths: 6, oil: " 5W-30 full synthetic, extra long ", today: new Date(2026, 9, 17) });
    expect(f).toMatchObject({ date: "10/17/26", mileage: 48000, nextMileage: 53000, nextDate: "04/17/27" });
    expect(f.oil).toBe("5W-30 full synthetic, ex");
    expect(oilStickerFields({ ...e, odometer: null, job: null }, { intervalMiles: 5000, intervalMonths: 6, oil: null, today: new Date(2026, 9, 17) }).nextMileage).toBeNull();
  });

  it("the interval is clamped and read from the query with defaults", () => {
    expect(oilStickerOptions(new URLSearchParams())).toMatchObject({ intervalMiles: 5000, intervalMonths: 6, oil: null });
    expect(oilStickerOptions(new URLSearchParams("miles=7500&months=12&oil=0W-20"))).toMatchObject({ intervalMiles: 7500, intervalMonths: 12, oil: "0W-20" });
    expect(oilStickerFields({ ...e, odometer: 1000, job: null }, { intervalMiles: 10, intervalMonths: 99, oil: null }).nextMileage).toBe(1500);
  });

  it("renders small pages: 4 × 2 in and 3 × 2 in", async () => {
    const tag = await keyTagPdf(e);
    const sticker = await oilStickerPdf(e, { intervalMiles: 5000, intervalMonths: 6, oil: "5W-30" });
    expect(tag.subarray(0, 5).toString()).toBe("%PDF-");
    expect(sticker.subarray(0, 5).toString()).toBe("%PDF-");
    expect(tag.toString("latin1")).toMatch(/\/MediaBox \[ ?0 0 288 144 ?\]/);
    expect(sticker.toString("latin1")).toMatch(/\/MediaBox \[ ?0 0 216 144 ?\]/);
  });
});
