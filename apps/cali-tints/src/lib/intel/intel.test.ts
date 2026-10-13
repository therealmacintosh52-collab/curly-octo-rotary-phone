import { describe, expect, it } from "vitest";
import { dateOrNull, decodeIsUsable, parseComplaint, parseDecodedVin, parseRecall } from "./nhtsa-parse";
import { complaintsForComponents, groupByComponent, relatedComplaints, searchComplaints, trendByYear } from "./complaints";
import { DTC_SYSTEM_COMPONENTS, DTC_SYSTEM_TERMS } from "./dtc-systems";
import { inferDtcSystem, intelPathFor, parseDtcList } from "./dtc";
import { vinModelYear } from "@/lib/vin";
import type { Complaint } from "./types";

describe("nhtsa parse", () => {
  it("builds an engine string and specs from a vPIC row", () => {
    const d = parseDecodedVin("1FTEW1EF5FFA12345", {
      Make: "FORD", Model: "F-150", ModelYear: "2015", Trim: "XLT", DisplacementL: "5", EngineCylinders: "8", EngineConfiguration: "V-Shaped", Turbo: "",
      DriveType: "4WD/4-Wheel Drive/4x4", BodyClass: "Pickup", FuelTypePrimary: "Gasoline", TransmissionSpeeds: "6", TransmissionStyle: "Automatic",
      ErrorCode: "0", ErrorText: "0 - VIN decoded clean. Check Digit (9th position) is correct", PlantCity: "DEARBORN", PlantCountry: "UNITED STATES (USA)", GVWR: "Not Applicable",
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
    expect(c.components).toEqual(["ENGINE", "FUEL SYSTEM", "GASOLINE"]);
    expect(c.dateOfIncident).toBe("2019-01-15");
    expect(c.mileage).toBe(54000);
    expect(c.odiNumber).toBe("11234567");
  });
});

const mk = (over: Partial<Complaint>): Complaint => ({
  source: "NHTSA", odiNumber: Math.random().toString(), components: ["ENGINE"], summary: "", dateOfIncident: null, dateComplaintFiled: null, crash: false, fire: false, injuries: 0, deaths: 0, mileage: null, ...over,
});

describe("complaints", () => {
  const data = [
    mk({ odiNumber: "1", components: ["ENGINE"], dateComplaintFiled: "2016-02-01", summary: "Loud rattle on cold start" }),
    mk({ odiNumber: "2", components: ["ENGINE", "ELECTRICAL SYSTEM"], dateComplaintFiled: "2016-05-01", crash: true, summary: "stalled" }),
    mk({ odiNumber: "3", components: ["POWER TRAIN"], dateComplaintFiled: "2018-01-01", summary: "shudder when shifting" }),
    mk({ odiNumber: "4", components: ["SERVICE BRAKES"], dateOfIncident: "2017-03-03", summary: "brake pedal to floor" }),
  ];
  it("groups by primary component, sorted by count", () => {
    const g = groupByComponent(data);
    expect(g[0].component).toBe("ENGINE");
    expect(g[0].count).toBe(2);
    expect(g[0].crashes).toBe(1);
    expect(g.map((x) => x.component)).toEqual(["ENGINE", "POWER TRAIN", "SERVICE BRAKES"]);
  });
  it("fills missing years in the trend", () => {
    expect(trendByYear(data)).toEqual([
      { year: 2016, count: 2 },
      { year: 2017, count: 1 },
      { year: 2018, count: 1 },
    ]);
  });
  it("matches components and terms for a code's system, deduplicated", () => {
    expect(complaintsForComponents(data, DTC_SYSTEM_COMPONENTS.transmission)).toHaveLength(1);
    expect(complaintsForComponents(data, DTC_SYSTEM_COMPONENTS.chassis)).toHaveLength(1);
    expect(searchComplaints(data, ["rattle"])).toHaveLength(1);
    const related = relatedComplaints(data, DTC_SYSTEM_COMPONENTS.vvt, DTC_SYSTEM_TERMS.vvt);
    expect(related.map((c) => c.odiNumber)).toEqual(["1", "2"]); // the rattle by keyword first, then the other engine complaint
  });
});

describe("trouble codes", () => {
  it("parses lists and infers systems", () => {
    expect(parseDtcList("p0300, P0171;p0174 junk U0100 P030")).toEqual(["P0300", "P0171", "P0174", "U0100"]);
    expect(inferDtcSystem("P1234").system).toBe("fuel_air");
    expect(inferDtcSystem("P0A80").system).toBe("hybrid_ev");
    expect(inferDtcSystem("C1234").system).toBe("chassis");
    expect(inferDtcSystem("P0750").system).toBe("transmission");
  });
  it("routes the lookup box", () => {
    expect(intelPathFor("p0300")).toBe("/intel/dtc?codes=P0300");
    expect(intelPathFor("P0300, u0100 c1234")).toBe("/intel/dtc?codes=P0300%2CU0100%2CC1234");
    expect(intelPathFor("4t1bf1fk5cu123456")).toBe("/intel/garage?vin=4T1BF1FK5CU123456");
    expect(intelPathFor("4T1BF1FK5CU12345O")).toBe("/intel/garage"); // O is never in a VIN
    expect(intelPathFor("  ")).toBe("/intel/garage");
  });
  it("derives the model year from a VIN", () => {
    expect(vinModelYear("1HGCM82633A004352")).toBe(2003);
    expect(vinModelYear("1FTEW1EF5FFA12345")).toBe(2015);
    expect(vinModelYear("not a vin")).toBeNull();
  });
});

import { fixSchema } from "./fix-schema";
import { estimateLinesFromFix, fixCodesFromText, fixCarName, matchLabel } from "./fixes";

describe("fix library", () => {
  const base = { title: "Misfire on cold start", year: "2019", make: "Toyota", model: "Camry", symptoms: "Shakes at idle when cold", root_cause: "Worn plugs", fix_description: "Replaced the plugs and coils" };
  it("validates a fix like the database does", () => {
    const ok = fixSchema.parse({ ...base, codes: ["P0300"], parts: [{ name: "Plug", quantity: "4", unit_price: "11.5" }], labor_hours: "1.5" });
    expect(ok.year).toBe(2019);
    expect(ok.parts[0]).toMatchObject({ quantity: 4, unit_price: 11.5, part_number: null });
    expect(ok.labor_hours).toBe(1.5);
    expect(fixSchema.safeParse({ ...base, title: "short" }).success).toBe(false);
    expect(fixSchema.safeParse({ ...base, codes: ["X1234"] }).success).toBe(false);
    expect(fixSchema.safeParse({ ...base, year: "1900" }).success).toBe(false);
    expect(fixSchema.safeParse({ ...base, codes: Array.from({ length: 21 }, (_, i) => `P${String(i).padStart(4, "0")}`) }).success).toBe(false);
  });
  it("finds trouble codes in free text", () => {
    expect(fixCodesFromText("Rear pads, then p0300 and P0301; also u0100 (P0300 again) and P03000")).toEqual(["P0300", "P0301", "U0100"]);
    expect(fixCodesFromText("no codes here")).toEqual([]);
  });
  it("turns a fix into estimate lines: labor first, then the parts", () => {
    const lines = estimateLinesFromFix({ fix_id: "f", title: "Plugs", lines: [{ line_type: "labor", label: "Plugs", hours: 1.5, rate: 120 }, { line_type: "part", label: "Spark plug", part_number: "SP-4", qty: 4, price: 11.5 }, { line_type: "part", label: "Coil boot", qty: 2, price: null }] });
    expect(lines.map((l) => l.line_type)).toEqual(["labor", "part", "part"]);
    expect(lines[0]).toMatchObject({ label: "Plugs", hours: 1.5, rate: null });
    expect(lines[1]).toMatchObject({ part_number: "SP-4", qty: 4, price: 11.5 });
    expect(lines[2].price).toBeNull();
  });
  it("labels", () => {
    expect(matchLabel("exact")).toBeNull();
    expect(matchLabel("near_year")).toBe("nearby year");
    expect(fixCarName({ year: 2019, make: "Toyota", model: "Camry", engine: "2.5L I4" })).toBe("2019 Toyota Camry · 2.5L I4");
  });
});
