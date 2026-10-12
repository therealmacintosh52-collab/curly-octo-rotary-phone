import { describe, expect, it } from "vitest";
import { complaintsForComponents, groupByComponent, searchComplaints, trendByYear } from "@/lib/vehicles/complaints";
import type { Complaint } from "@/lib/providers/types";
import { DTC_SYSTEM_COMPONENTS } from "@/lib/dtc/systems";

const mk = (over: Partial<Complaint>): Complaint => ({
  source: "NHTSA",
  odiNumber: Math.random().toString(),
  components: ["ENGINE"],
  summary: "",
  dateOfIncident: null,
  dateComplaintFiled: null,
  crash: false,
  fire: false,
  injuries: 0,
  deaths: 0,
  mileage: null,
  ...over,
});

describe("complaints", () => {
  const data = [
    mk({ components: ["ENGINE"], dateComplaintFiled: "2016-02-01", summary: "Loud rattle on cold start" }),
    mk({ components: ["ENGINE", "ELECTRICAL SYSTEM"], dateComplaintFiled: "2016-05-01", crash: true, summary: "stalled" }),
    mk({ components: ["POWER TRAIN"], dateComplaintFiled: "2018-01-01", summary: "shudder when shifting" }),
    mk({ components: ["SERVICE BRAKES"], dateOfIncident: "2017-03-03", summary: "brake pedal to floor" }),
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
  it("matches components for a DTC system", () => {
    expect(complaintsForComponents(data, DTC_SYSTEM_COMPONENTS.transmission)).toHaveLength(1);
    expect(complaintsForComponents(data, DTC_SYSTEM_COMPONENTS.chassis)).toHaveLength(1);
    expect(searchComplaints(data, ["rattle"])).toHaveLength(1);
  });
});
