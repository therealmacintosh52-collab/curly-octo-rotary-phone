import { describe, expect, it } from "vitest";
import { customerLinkForJob } from "./customer-link";

type Est = { id: string; kind: string; status: string; applied_at: string | null };
function stub(ests: Est[]) {
  return {
    rpc: async (name: string) => {
      if (name === "job_estimates") return { data: ests };
      if (name === "estimate_link") return { data: "etok" };
      if (name === "receipt_link") return { data: "rtok" };
      return { data: null };
    },
  } as never;
}

describe("customerLinkForJob", () => {
  it("links an open extra-work estimate to its approval page", async () => {
    const url = await customerLinkForJob(stub([{ id: "s1", kind: "supplement", status: "sent", applied_at: null }]), "j1", "https://x");
    expect(url).toBe("https://x/e/etok");
  });
  it("falls back to the receipt page when nothing is waiting", async () => {
    expect(await customerLinkForJob(stub([{ id: "s1", kind: "supplement", status: "accepted", applied_at: "2026-01-01" }]), "j1", "https://x")).toBe("https://x/r/rtok");
    expect(await customerLinkForJob(stub([]), "j1", "https://x")).toBe("https://x/r/rtok");
  });
});
