import { describe, expect, it } from "vitest";
import { bayintelBase, bayintelConfigured, bayintelOrigin, bayintelUrl, parseBayintelMessage } from "./bridge";

const URL_ = "https://bayintel.example.com/";

describe("BayIntel bridge", () => {
  it("reads the URL from the environment and joins paths", () => {
    expect(bayintelBase(URL_)).toBe("https://bayintel.example.com");
    expect(bayintelConfigured(undefined)).toBe(false);
    expect(bayintelConfigured("not a url")).toBe(false);
    expect(bayintelUrl("/dtc?codes=P0300", URL_)).toBe("https://bayintel.example.com/dtc?codes=P0300");
    expect(bayintelUrl(undefined, URL_)).toBe("https://bayintel.example.com/garage");
    expect(bayintelUrl("//evil.example.com", URL_)).toBe("https://bayintel.example.com/garage");
    expect(bayintelUrl("/garage", "")).toBeNull();
    expect(bayintelOrigin(URL_)).toBe("https://bayintel.example.com");
  });

  it("accepts messages from BayIntel's origin only, in the two known shapes", () => {
    expect(parseBayintelMessage({ origin: "https://bayintel.example.com", data: { type: "bayintel:close" } }, URL_)).toEqual({ type: "bayintel:close" });
    expect(parseBayintelMessage({ origin: "https://bayintel.example.com", data: { type: "bayintel:navigate", path: "/vehicles/42" } }, URL_)).toEqual({ type: "bayintel:navigate", path: "/vehicles/42" });
    expect(parseBayintelMessage({ origin: "https://other.example.com", data: { type: "bayintel:close" } }, URL_)).toBeNull();
    expect(parseBayintelMessage({ origin: "https://bayintel.example.com", data: { type: "bayintel:navigate", path: "https://x" } }, URL_)).toBeNull();
    expect(parseBayintelMessage({ origin: "https://bayintel.example.com", data: "close" }, URL_)).toBeNull();
    expect(parseBayintelMessage({ origin: "https://bayintel.example.com", data: { type: "bayintel:close" } }, "")).toBeNull();
  });
});
