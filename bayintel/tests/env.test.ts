import { describe, expect, it } from "vitest";
import { isConfigured, missingConfig } from "@/lib/env";

describe("deployment config", () => {
  it("names the missing Supabase variables", () => {
    expect(missingConfig({})).toEqual(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
    expect(missingConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: " " })).toEqual(["NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
    expect(isConfigured({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" })).toBe(true);
    expect(isConfigured({})).toBe(false);
  });
});
