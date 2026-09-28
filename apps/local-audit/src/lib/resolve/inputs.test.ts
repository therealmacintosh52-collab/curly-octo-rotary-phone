import { describe, expect, it } from "vitest";
import { classifyUrl, hasResolvableInput, normalizeUrl, parseGbpInput, parseInputs, yelpAlias } from "./inputs";
import { parseMapsUrl } from "./maps-url";

describe("normalizeUrl", () => {
  it("adds https to bare domains and rejects junk", () => {
    expect(normalizeUrl("testplumbing.example")?.toString()).toBe("https://testplumbing.example/");
    expect(normalizeUrl("http://www.Example.com/a?b=1#frag")?.toString()).toBe("http://www.example.com/a?b=1");
    expect(normalizeUrl("not a url")).toBeNull();
    expect(normalizeUrl("mailto:x@y.z")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
  });
});

describe("yelpAlias", () => {
  it("reads the alias from /biz/", () => {
    expect(yelpAlias(new URL("https://www.yelp.com/biz/test-plumbing-sacramento?osq=plumber"))).toBe("test-plumbing-sacramento");
    expect(yelpAlias(new URL("https://www.yelp.com/search?find_desc=plumber"))).toBeNull();
    expect(yelpAlias(new URL("https://example.com/biz/x"))).toBeNull();
  });
});

describe("classifyUrl", () => {
  it("recognises socials, directories, maps, yelp and plain websites", () => {
    expect(classifyUrl("https://www.facebook.com/testplumbing")).toMatchObject({ kind: "social", network: "facebook" });
    expect(classifyUrl("instagram.com/testplumbing")).toMatchObject({ kind: "social", network: "instagram" });
    expect(classifyUrl("https://www.bbb.org/us/ca/sacramento/profile/plumber/test-plumbing")).toMatchObject({ kind: "directory", directory: "bbb" });
    expect(classifyUrl("https://maps.app.goo.gl/abc123")).toMatchObject({ kind: "maps" });
    expect(classifyUrl("https://www.google.com/maps/place/Test+Plumbing/@38.5,-121.4,17z")).toMatchObject({ kind: "maps" });
    expect(classifyUrl("https://www.yelp.com/biz/test-plumbing-sacramento")).toMatchObject({ kind: "yelp" });
    expect(classifyUrl("https://testplumbing.example")).toMatchObject({ kind: "website" });
    expect(classifyUrl("???")).toMatchObject({ kind: "unknown" });
  });
});

describe("parseMapsUrl", () => {
  it("parses a full place URL with data blob", () => {
    const url = new URL(
      "https://www.google.com/maps/place/Test+Plumbing/@38.5816,-121.4944,17z/data=!3m1!4b1!4m6!3m5!1s0x809ad12f3a2b1c3d:0xa1b2c3d4e5f60718!8m2!3d38.581572!4d-121.4943996!16s%2Fg%2F11abcxyz",
    );
    expect(parseMapsUrl(url)).toEqual({
      name: "Test Plumbing",
      lat: 38.581572,
      lng: -121.4943996,
      ftid: "0x809ad12f3a2b1c3d:0xa1b2c3d4e5f60718",
      kgId: "/g/11abcxyz",
    });
  });
  it("parses place_id, cid and search forms", () => {
    expect(parseMapsUrl(new URL("https://www.google.com/maps/search/?api=1&query=Test+Plumbing&query_place_id=ChIJabc123"))).toMatchObject({ query: "Test Plumbing", placeId: "ChIJabc123" });
    expect(parseMapsUrl(new URL("https://maps.google.com/?cid=1234567890"))).toMatchObject({ cid: "1234567890" });
    expect(parseMapsUrl(new URL("https://www.google.com/maps?q=place_id:ChIJxyz"))).toMatchObject({ placeId: "ChIJxyz" });
    expect(parseMapsUrl(new URL("https://www.google.com/maps/search/plumber+sacramento/@38.5,-121.4,12z"))).toMatchObject({ query: "plumber sacramento", lat: 38.5 });
  });
  it("returns null for non-Google hosts and {} for an empty maps URL", () => {
    expect(parseMapsUrl(new URL("https://example.com/maps/place/x"))).toBeNull();
    expect(parseMapsUrl(new URL("https://www.google.com/maps"))).toEqual({});
  });
});

describe("parseGbpInput", () => {
  it("classifies short links, maps URLs and text", () => {
    expect(parseGbpInput("https://maps.app.goo.gl/AbCdEf")).toEqual({ kind: "short_link", url: "https://maps.app.goo.gl/AbCdEf" });
    expect(parseGbpInput("maps.app.goo.gl/AbCdEf")).toEqual({ kind: "short_link", url: "https://maps.app.goo.gl/AbCdEf" });
    expect(parseGbpInput("https://www.google.com/maps/place/Test+Plumbing/@38.5,-121.4,17z")).toMatchObject({ kind: "maps_url", parsed: { name: "Test Plumbing" } });
    expect(parseGbpInput("Test Plumbing,   Sacramento CA")).toEqual({ kind: "text", query: "Test Plumbing, Sacramento CA" });
    expect(parseGbpInput("https://example.com/not-maps")).toBeNull();
    expect(parseGbpInput("")).toBeNull();
  });
});

describe("parseInputs", () => {
  it("parses a full set and reports problems instead of dropping them", () => {
    const p = parseInputs({
      website: "testplumbing.example",
      gbp: "https://maps.app.goo.gl/AbCdEf",
      yelp: "https://www.yelp.com/biz/test-plumbing-sacramento",
      extraUrls: "https://www.facebook.com/testplumbing\nhttps://www.bbb.org/x, ???",
      serviceArea: " Sacramento, CA ",
      services: "plumbing, water heaters",
      avgTicket: "350",
    });
    expect(p.website).toEqual({ url: "https://testplumbing.example/", host: "testplumbing.example" });
    expect(p.gbp).toEqual({ kind: "short_link", url: "https://maps.app.goo.gl/AbCdEf" });
    expect(p.yelp).toEqual({ url: "https://www.yelp.com/biz/test-plumbing-sacramento", alias: "test-plumbing-sacramento" });
    expect(p.extras.map((e) => e.kind)).toEqual(["social", "directory", "unknown"]);
    expect(p.serviceArea).toBe("Sacramento, CA");
    expect(p.services).toEqual(["plumbing", "water heaters"]);
    expect(p.avgTicket).toBe(350);
    expect(p.problems).toEqual(['Extra URL "???" could not be parsed.']);
    expect(hasResolvableInput(p)).toBe(true);
  });
  it("flags invalid website, gbp, yelp and ticket", () => {
    const p = parseInputs({ website: "nope nope", gbp: "https://example.com/x", yelp: "https://www.yelp.com/search", avgTicket: "-5" });
    expect(p.problems).toHaveLength(4);
    expect(hasResolvableInput(p)).toBe(false);
  });
});
