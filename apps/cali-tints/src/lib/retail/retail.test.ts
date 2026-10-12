import { describe, expect, it } from "vitest";
import { sizeClassForBody } from "./size-class";
import { detectPlatform, formatPhone, isPhoneShape, phoneDigits, smsHref, telHref } from "./phone";

describe("sizeClassForBody (mirrors size_class_for_body in SQL)", () => {
  it("maps NHTSA body classes", () => {
    expect(sizeClassForBody("Sedan/Saloon")).toBe("sedan");
    expect(sizeClassForBody("Wagon")).toBe("sedan");
    expect(sizeClassForBody("Sport Utility Vehicle (SUV)/Multi-Purpose Vehicle (MPV)")).toBe("suv_truck");
    expect(sizeClassForBody("Crossover Utility Vehicle (CUV)")).toBe("suv_truck");
    expect(sizeClassForBody("Pickup")).toBe("suv_truck");
    expect(sizeClassForBody("Hatchback/Liftback/Notchback")).toBe("compact");
    expect(sizeClassForBody("Coupe")).toBe("compact");
    expect(sizeClassForBody("Convertible/Cabriolet")).toBe("compact");
    expect(sizeClassForBody("Van")).toBe("xl");
    expect(sizeClassForBody("Minivan")).toBe("xl");
    expect(sizeClassForBody("Cargo Van")).toBe("xl");
    expect(sizeClassForBody("Bus")).toBe("xl");
    expect(sizeClassForBody(null)).toBe("sedan");
    expect(sizeClassForBody("")).toBe("sedan");
  });
});

describe("phone helpers (mirror phone_digits in SQL)", () => {
  it("normalises digits", () => {
    expect(phoneDigits("(916) 555-0100")).toBe("9165550100");
    expect(phoneDigits("+1 916 555 0100")).toBe("9165550100");
    expect(phoneDigits("")).toBeNull();
    expect(phoneDigits(null)).toBeNull();
  });
  it("formats ten digits", () => {
    expect(formatPhone("9165550100")).toBe("(916) 555-0100");
    expect(formatPhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
  });
  it("validates shape", () => {
    expect(isPhoneShape("916-555-0100")).toBe(true);
    expect(isPhoneShape("12345")).toBe(false);
  });
  it("builds tel and sms links per platform", () => {
    expect(telHref("916-555-0100")).toBe("tel:+19165550100");
    expect(smsHref("916-555-0100", "Hi Ana", "ios")).toBe("sms:+19165550100&body=Hi%20Ana");
    expect(smsHref("916-555-0100", "Hi Ana", "android")).toBe("sms:+19165550100?body=Hi%20Ana");
    expect(smsHref("916-555-0100", "")).toBe("sms:+19165550100");
    expect(smsHref("", "x")).toBeNull();
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14)")).toBe("android");
    expect(detectPlatform(undefined)).toBe("unknown");
  });
});
