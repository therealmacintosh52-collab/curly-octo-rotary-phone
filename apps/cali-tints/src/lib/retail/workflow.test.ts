import { describe, expect, it } from "vitest";
import type { EstimateListRow } from "@/lib/db/types";
import { laneFor, workflowLanes } from "./workflow";

const row = (o: Partial<EstimateListRow>) => ({ id: "x", status: "accepted", parts_status: "none", tech_id: null, ...o }) as EstimateListRow;

describe("laneFor", () => {
  it("keeps estimates that are not approved in Estimates", () => {
    expect(laneFor(row({ status: "draft", tech_id: "t1" }))).toBe("estimates");
    expect(laneFor(row({ status: "sent" }))).toBe("estimates");
    expect(laneFor(row({ status: "viewed" }))).toBe("estimates");
  });
  it("puts an approved work order with no tech with the advisor", () => {
    expect(laneFor(row({}))).toBe("ready");
  });
  it("puts it under the tech who holds it", () => {
    expect(laneFor(row({ tech_id: "t1" }))).toBe("tech:t1");
  });
  it("parts needed or ordered win over the tech", () => {
    expect(laneFor(row({ tech_id: "t1", parts_status: "needed" }))).toBe("parts");
    expect(laneFor(row({ parts_status: "ordered" }))).toBe("parts");
    expect(laneFor(row({ tech_id: "t1", parts_status: "arrived" }))).toBe("tech:t1");
  });
});

describe("workflowLanes", () => {
  const techs = [{ id: "t1", name: "Victor Kim", initials: "VK" }, { id: "t2", name: "Dee One", initials: "DO" }];
  it("orders the columns and gives every tech one", () => {
    const lanes = workflowLanes([row({ id: "a", tech_id: "t2" }), row({ id: "b", parts_status: "needed" }), row({ id: "c", status: "draft" })], techs);
    expect(lanes.map((l) => l.title)).toEqual(["Estimates", "Ready to send RO to tech", "Victor Kim", "Dee One", "Waiting for parts"]);
    expect(lanes.map((l) => l.items.length)).toEqual([1, 0, 0, 1, 1]);
  });
  it("keeps a column for a tech who is not on the roster any more", () => {
    const lanes = workflowLanes([row({ id: "a", tech_id: "gone", holder: "ZZ" })], techs);
    expect(lanes.some((l) => l.key === "tech:gone" && l.title === "ZZ" && l.items.length === 1)).toBe(true);
  });
});
