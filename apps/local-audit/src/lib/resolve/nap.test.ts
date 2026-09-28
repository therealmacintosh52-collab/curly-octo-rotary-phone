import { describe, expect, it } from "vitest";
import { compareNap, extractNapFromHtml, formatPhone, normalizeAddress, normalizeName, normalizePhone } from "./nap";

describe("normalizePhone", () => {
  it("normalizes NANP formats to E.164 and rejects the rest", () => {
    expect(normalizePhone("(916) 555-0100")).toBe("+19165550100");
    expect(normalizePhone("916.555.0100")).toBe("+19165550100");
    expect(normalizePhone("+1 916 555 0100")).toBe("+19165550100");
    expect(normalizePhone("1-916-555-0100 ext 12")).toBe("+19165550100");
    expect(normalizePhone("555-0100")).toBeNull();
    expect(normalizePhone("(016) 555-0100")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(formatPhone("+19165550100")).toBe("(916) 555-0100");
  });
});

describe("normalizeName", () => {
  it("strips suffixes, punctuation and the article", () => {
    expect(normalizeName("The Test Plumbing Co., LLC")).toBe("test plumbing");
    expect(normalizeName("Test & Sons Plumbing Inc")).toBe("test and sons plumbing");
    expect(normalizeName("O'Brien's Plumbing")).toBe("obriens plumbing");
  });
});

describe("normalizeAddress", () => {
  it("makes formatting variants comparable", () => {
    const a = normalizeAddress("1 Main St, Suite 200, Sacramento, CA 95814");
    const b = normalizeAddress("1 Main Street Ste 200 Sacramento CA 95814-1234");
    const c = normalizeAddress("1 MAIN ST., SACRAMENTO, CA 95814, USA");
    expect(a?.key).toBe("1 main st 95814");
    expect(b?.key).toBe(a?.key);
    expect(c?.key).toBe(a?.key);
    expect(a?.zip).toBe("95814");
    expect(a?.streetNumber).toBe("1");
  });
  it("keeps different addresses different", () => {
    expect(normalizeAddress("1 Main St, Sacramento, CA 95814")?.key).not.toBe(normalizeAddress("2 Main St, Sacramento, CA 95814")?.key);
    expect(normalizeAddress("1 Main St, Sacramento, CA 95814")?.key).not.toBe(normalizeAddress("1 Main Ave, Sacramento, CA 95814")?.key);
  });
  it("handles directional prefixes and no zip", () => {
    expect(normalizeAddress("2400 North Fulton Avenue")?.key).toBe("2400 n fulton ave");
    expect(normalizeAddress("")).toBeNull();
  });
});

describe("compareNap", () => {
  it("matches across formatting differences and flags real disagreements", () => {
    const c = compareNap([
      { source: "website", name: "Test Plumbing LLC", phone: "(916) 555-0100", address: "1 Main St, Ste 200, Sacramento, CA 95814" },
      { source: "gbp", name: "Test Plumbing", phone: "+1 916-555-0100", address: "1 Main Street, Sacramento, CA 95814" },
      { source: "yelp", name: "Test Plumbing", phone: "9165550199", address: "1 Main St, Sacramento, CA 95814" },
    ]);
    expect(c.name.status).toBe("match");
    expect(c.address.status).toBe("match");
    expect(c.phone.status).toBe("mismatch");
    expect(c.phone.values.map((v) => v.normalized)).toEqual(["+19165550100", "+19165550100", "+19165550199"]);
  });
  it("treats a name that contains the other as agreement, and one source as insufficient", () => {
    const c = compareNap([
      { source: "website", name: "Test Plumbing Sacramento", phone: "(916) 555-0100" },
      { source: "gbp", name: "Test Plumbing" },
    ]);
    expect(c.name.status).toBe("match");
    expect(c.phone.status).toBe("insufficient");
    expect(c.address.status).toBe("insufficient");
  });
});

describe("extractNapFromHtml", () => {
  const html = `<!doctype html><html><head><title>Test Plumbing | Sacramento Plumber</title>
  <meta property="og:site_name" content="Test Plumbing">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Plumber","name":"Test Plumbing","telephone":"+1-916-555-0100","address":{"@type":"PostalAddress","streetAddress":"1 Main St","addressLocality":"Sacramento","addressRegion":"CA","postalCode":"95814"}}</script>
  </head><body><header><a href="tel:+19165550100">(916) 555-0100</a></header>
  <footer><address>1 Main St<br>Sacramento, CA 95814</address> Call 916-555-0101 for emergencies. 987 Oak Avenue, Suite 4, Elk Grove, CA 95624</footer></body></html>`;

  it("collects phones from tel links, JSON-LD and text", () => {
    const nap = extractNapFromHtml(html);
    expect(nap.telLinks).toEqual(["+19165550100"]);
    expect(nap.phones).toEqual(["+19165550100", "+19165550101"]);
  });
  it("collects addresses from JSON-LD, <address> and street patterns", () => {
    const nap = extractNapFromHtml(html);
    expect(nap.addresses).toContain("1 Main St, Sacramento, CA, 95814");
    expect(nap.addresses).toContain("1 Main St, Sacramento, CA 95814");
    expect(nap.addresses.some((a) => a.startsWith("987 Oak Avenue"))).toBe(true);
  });
  it("collects candidate names", () => {
    const nap = extractNapFromHtml(html);
    expect(nap.names).toEqual(["Test Plumbing"]);
    expect(nap.jsonLd[0]).toMatchObject({ "@type": "Plumber" });
  });
  it("copes with an empty page", () => {
    expect(extractNapFromHtml("<html></html>")).toEqual({ phones: [], addresses: [], names: [], jsonLd: [], telLinks: [] });
  });
});
