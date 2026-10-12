import { describe, expect, it } from "vitest";
import { dateOrNull, decodeIsUsable, parseComplaint, parseDecodedVin, parseRecall } from "@/lib/providers/nhtsa-parse";

describe("nhtsa parse", () => {
  it("builds an engine string and specs from a vPIC row", () => {
    const d = parseDecodedVin("1FTEW1EF5FFA12345", {
      Make: "FORD",
      Model: "F-150",
      ModelYear: "2015",
      Trim: "XLT",
      DisplacementL: "5",
      EngineCylinders: "8",
      EngineConfiguration: "V-Shaped",
      Turbo: "",
      DriveType: "4WD/4-Wheel Drive/4x4",
      BodyClass: "Pickup",
      FuelTypePrimary: "Gasoline",
      TransmissionSpeeds: "6",
      TransmissionStyle: "Automatic",
      ErrorCode: "0",
      ErrorText: "0 - VIN decoded clean. Check Digit (9th position) is correct",
      PlantCity: "DEARBORN",
      PlantCountry: "UNITED STATES (USA)",
      GVWR: "Not Applicable",
    });
    expect(d.engine).toBe("5.0L V8");
    expect(d.year).toBe(2015);
    expect(d.transmission).toBe("6-speed Automatic");
    expect(d.specs.GVWR).toBeUndefined();
    expect(d.specs.Make).toBe("FORD");
    expect(decodeIsUsable(d)).toBe(true);
  });
  it("marks turbo inline engines", () => {
    const d = parseDecodedVin("19XFC1F39GE000000", { Make: "HONDA", Model: "Civic", ModelYear: "2016", DisplacementL: "1.5", EngineCylinders: "4", EngineConfiguration: "In-Line", Turbo: "Yes", ErrorCode: "0" });
    expect(d.engine).toBe("1.5L I4 Turbo");
  });
  it("rejects unusable decodes", () => {
    const d = parseDecodedVin("ZZZZZZZZZZZZZZZZZ", { Make: "", Model: "", ModelYear: "", ErrorCode: "11", ErrorText: "11 - Incorrect Model Year" });
    expect(decodeIsUsable(d)).toBe(false);
  });
  it("parses dates per endpoint convention", () => {
    expect(dateOrNull("02/09/2016", "dmy")).toBe("2016-09-02");
    expect(dateOrNull("02/09/2016", "mdy")).toBe("2016-02-09");
    expect(dateOrNull("25/09/2016", "mdy")).toBe("2016-09-25"); // impossible as mdy, swapped
    expect(dateOrNull("", "mdy")).toBeNull();
  });
  it("parses recalls and complaints", () => {
    const r = parseRecall({ NHTSACampaignNumber: "16V643000", Component: "EXTERIOR LIGHTING", Summary: "s", Consequence: "c", Remedy: "r", ReportReceivedDate: "02/09/2016", parkIt: false, parkOutSide: "false", Manufacturer: "Ford" });
    expect(r.reportDate).toBe("2016-09-02");
    expect(r.source).toBe("NHTSA");
    const c = parseComplaint({ odiNumber: 11234567, components: "ENGINE,FUEL SYSTEM, GASOLINE", summary: "ROUGH IDLE", dateOfIncident: "01/15/2019", dateComplaintFiled: "01/20/2019", crash: false, fire: false, numberOfInjuries: 0, numberOfDeaths: 0, odometer: 54000 });
    expect(c.components).toEqual(["ENGINE", "FUEL SYSTEM, GASOLINE".split(", ")[0] === "FUEL SYSTEM" ? "FUEL SYSTEM" : "FUEL SYSTEM", "GASOLINE"]);
    expect(c.dateOfIncident).toBe("2019-01-15");
    expect(c.mileage).toBe(54000);
    expect(c.odiNumber).toBe("11234567");
  });
});
