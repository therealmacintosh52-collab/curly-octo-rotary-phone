import { describe, expect, it } from "vitest";
import { cacheKey, canonicalJson } from "./cache-key";

describe("canonicalJson", () => {
  it("sorts keys recursively and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: { d: undefined, c: [3, { z: 1, y: 2 }] } })).toBe('{"a":{"c":[3,{"y":2,"z":1}]},"b":1}');
  });
  it("keeps array order", () => {
    expect(canonicalJson([2, 1])).toBe("[2,1]");
  });
});

describe("cacheKey", () => {
  it("is independent of key order", () => {
    expect(cacheKey("p", "e", { a: 1, b: 2 })).toBe(cacheKey("p", "e", { b: 2, a: 1 }));
  });
  it("changes with provider, endpoint or request", () => {
    const base = cacheKey("p", "e", { a: 1 });
    expect(cacheKey("q", "e", { a: 1 })).not.toBe(base);
    expect(cacheKey("p", "f", { a: 1 })).not.toBe(base);
    expect(cacheKey("p", "e", { a: 2 })).not.toBe(base);
  });
  it("is a sha256 hex digest", () => {
    expect(cacheKey("p", "e", {})).toMatch(/^[0-9a-f]{64}$/);
  });
});
