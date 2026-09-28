import { normalizeAddress, normalizePhone } from "@/lib/resolve/nap";
import type { JsonLdBlock } from "@/lib/crawl/page-analysis";
import { count, ev, home, listUrls, pagesOfKind, siteCheck, v } from "./util";

const C = "schema" as const;

const LOCAL_TYPES = /^(LocalBusiness|Plumber|Electrician|HVACBusiness|RoofingContractor|HousePainter|GeneralContractor|Locksmith|MovingCompany|AutoRepair|AutoBodyShop|Dentist|Physician|MedicalClinic|MedicalBusiness|Attorney|LegalService|AccountingService|InsuranceAgency|RealEstateAgent|Restaurant|CafeOrCoffeeShop|BarOrPub|FoodEstablishment|HairSalon|BeautySalon|DaySpa|NailSalon|TattooParlor|ExerciseGym|HealthClub|SportsActivityLocation|VeterinaryCare|AnimalShelter|ChildCare|Preschool|School|HomeAndConstructionBusiness|ProfessionalService|Store|AutoDealer|Florist|Bakery|Pharmacy|Optician|Hotel|LodgingBusiness|TravelAgency|FinancialService|EmploymentAgency|Electrician|DryCleaningOrLaundry|PestControl|Landscaping|LandscapingBusiness|CleaningService|Photographer|Dentist|Chiropractic|Physiotherapy|Optometric|SelfStorage|TaxiService|TouristAttraction|EntertainmentBusiness|NightClub|AutoWash|GasStation|TireShop|MotorcycleDealer|BikeStore|PetStore|ToyStore|ShoeStore|ClothingStore|FurnitureStore|HardwareStore|GardenStore|JewelryStore|ElectronicsStore|BookStore|MusicStore|ConvenienceStore|GroceryStore|LiquorStore|WholesaleStore)$/;

function localBlocks(pages: { jsonLd: JsonLdBlock[]; finalUrl: string }[]) {
  return pages.flatMap((p) => p.jsonLd.filter((b) => b.parsed && b.types.some((t) => LOCAL_TYPES.test(t) || /Business$/.test(t) || t === "Organization")).map((b) => ({ block: b, url: p.finalUrl })));
}

function field(obj: Record<string, unknown> | null, key: string): unknown {
  return obj ? obj[key] : undefined;
}

siteCheck({
  id: "localbusiness_missing",
  problem: "No machine-readable business card for Google",
  category: C,
  title: "LocalBusiness structured data present",
  description: "Schema markup is the hidden label that tells Google and AI assistants your name, address, phone, hours and category in a form they trust.",
  severity: "high",
  impact: 70,
  fix: "medium",
  run: (site) => (localBlocks(site.pages).length ? "pass" : { plain_english: "Your site does not carry the standard business card that Google and AI assistants read (name, address, phone and hours in a form machines understand). They have to guess your details from the page text.", evidence: [ev(`JSON-LD types found: ${[...new Set(site.pages.flatMap((p) => p.jsonLd.flatMap((b) => b.types)))].join(", ") || "none"}`, home(site).finalUrl)] }),
});

siteCheck({
  id: "invalid_json",
  problem: "Broken machine-readable business details",
  category: C,
  title: "Structured data parses",
  description: "A JSON-LD block with a syntax error is ignored completely; the markup might as well not exist.",
  severity: "medium",
  impact: 45,
  fix: "easy",
  run: (site) => {
    const bad = site.pages.flatMap((p) => p.jsonLd.filter((b) => b.error).map((b) => ({ p, b })));
    return bad.length ? { plain_english: `${count(bad.length, "of the machine-readable business detail block")} on your site are broken, so Google ignores them completely.`, evidence: bad.slice(0, 5).map(({ p, b }) => ev(`${b.error}: ${b.raw.slice(0, 120)}`, p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "localbusiness_generic_type",
  problem: "Business card does not say your trade",
  category: C,
  title: "Business schema uses a specific type",
  description: "'Plumber' or 'Dentist' tells search engines more than the generic 'LocalBusiness'.",
  severity: "low",
  impact: 15,
  fix: "easy",
  run: (site) => {
    const blocks = localBlocks(site.pages);
    if (!blocks.length) return { unavailable: "no LocalBusiness schema" };
    const generic = blocks.every(({ block }) => block.types.every((t) => t === "LocalBusiness" || t === "Organization"));
    return generic ? { plain_english: "Your machine-readable business card says only \"local business\" rather than your trade. Google and AI assistants know less about what you do than they could.", evidence: [ev(`@type ${blocks[0]!.block.types.join(",")}`, blocks[0]!.url)] } : "pass";
  },
});

const REQUIRED: { key: string; why: string; severity: "high" | "medium" | "low" }[] = [
  { key: "name", why: "the business name", severity: "high" },
  { key: "address", why: "the postal address", severity: "high" },
  { key: "telephone", why: "the phone number", severity: "high" },
  { key: "url", why: "the website address", severity: "medium" },
  { key: "image", why: "a photo or logo (Google will not show the business panel without one)", severity: "medium" },
  { key: "geo", why: "map coordinates", severity: "medium" },
  { key: "openingHoursSpecification|openingHours", why: "opening hours", severity: "medium" },
  { key: "priceRange", why: "a price range", severity: "low" },
  { key: "areaServed", why: "the service area", severity: "low" },
  { key: "sameAs", why: "links to your Google, Yelp and social profiles", severity: "medium" },
];

siteCheck({
  id: "localbusiness_incomplete",
  problem: "Machine-readable business card is incomplete",
  category: C,
  title: "LocalBusiness schema is complete",
  description: "Google's rich result and AI answer engines read specific fields; every missing one is a fact they have to find elsewhere.",
  severity: "medium",
  impact: 50,
  fix: "easy",
  run: (site) => {
    const blocks = localBlocks(site.pages).filter(({ block }) => block.types.some((t) => t !== "Organization"));
    if (!blocks.length) return { unavailable: "no LocalBusiness schema" };
    const best = blocks[0]!;
    const missing = REQUIRED.filter((r) => !r.key.split("|").some((k) => field(best.block.parsed, k) !== undefined && field(best.block.parsed, k) !== null && field(best.block.parsed, k) !== ""));
    if (!missing.length) return "pass";
    const worst = missing.some((m) => m.severity === "high") ? "high" : "medium";
    return { plain_english: `Your machine-readable business card is missing ${missing.map((m) => m.why).join(", ")}. Every missing fact is one Google has to find elsewhere, or does not show.`, evidence: [ev(`present: ${Object.keys(best.block.parsed ?? {}).filter((k) => !k.startsWith("@")).join(", ")}`, best.url)], severity: worst, impact_score: worst === "high" ? 60 : 40 };
  },
});

siteCheck({
  id: "schema_nap_mismatch",
  problem: "Hidden business details disagree with your listings",
  category: C,
  title: "Schema NAP matches the real NAP",
  description: "Structured data that disagrees with the visible page or the Google profile is worse than none.",
  severity: "high",
  impact: 60,
  fix: "easy",
  run: (site, ctx) => {
    const blocks = localBlocks(site.pages);
    if (!blocks.length) return { unavailable: "no LocalBusiness schema" };
    const b = blocks[0]!;
    const problems: string[] = [];
    const tel = field(b.block.parsed, "telephone");
    if (typeof tel === "string" && ctx.business.phone && normalizePhone(tel) && normalizePhone(tel) !== normalizePhone(ctx.business.phone)) problems.push(`schema telephone ${tel} vs resolved ${ctx.business.phone}`);
    const addr = field(b.block.parsed, "address") as Record<string, unknown> | string | undefined;
    const addrStr = typeof addr === "string" ? addr : addr ? [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode].filter(Boolean).join(", ") : null;
    if (addrStr && ctx.business.address) {
      const a = normalizeAddress(addrStr)?.key;
      const bKey = normalizeAddress(ctx.business.address)?.key;
      if (a && bKey && a !== bKey) problems.push(`schema address "${addrStr}" vs resolved "${ctx.business.address}"`);
    }
    return problems.length ? { plain_english: "The business details written into your website's code do not match the details on your other listings. Google sees two different businesses.", evidence: problems.map((p) => ev(p, b.url)) } : "pass";
  },
});

siteCheck({
  id: "service_schema_missing",
  problem: "Service pages are not described for Google",
  category: C,
  title: "Service pages carry Service schema",
  description: "Service markup helps engines connect each page to what you sell and where.",
  severity: "low",
  impact: 25,
  fix: "medium",
  run: (site) => {
    const services = pagesOfKind(site, "service");
    if (!services.length) return { unavailable: "no service pages found" };
    const without = services.filter((p) => !p.jsonLd.some((b) => b.types.includes("Service") || b.types.includes("Product") || b.types.includes("Offer")));
    return without.length === services.length ? { plain_english: `None of your ${count(services.length, "service page")} ${v(services.length, "describe")} the service in the form Google reads: ${listUrls(without)}. Google has to guess what each page offers.`, evidence: without.slice(0, 3).map((p) => ev(`JSON-LD types: ${p.jsonLd.flatMap((b) => b.types).join(", ") || "none"}`, p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "faq_schema_missing",
  problem: "Your answers are not marked up for Google's question results",
  category: C,
  title: "FAQ content has FAQPage schema",
  description: "Question-and-answer content marked up as FAQPage is what AI engines quote most readily.",
  severity: "low",
  impact: 25,
  fix: "easy",
  run: (site) => {
    const withFaq = site.pages.filter((p) => p.questionHeadings.length >= 2);
    if (!withFaq.length) return { unavailable: "no FAQ-style content found" };
    const unmarked = withFaq.filter((p) => !p.jsonLd.some((b) => b.types.includes("FAQPage")));
    return unmarked.length ? { plain_english: `${count(unmarked.length, "page")} ${v(unmarked.length, "answer")} customer questions, but not in the form Google uses to show questions and answers directly in search results: ${listUrls(unmarked)}.`, evidence: unmarked.slice(0, 3).map((p) => ev(p.questionHeadings.slice(0, 3).join(" | "), p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "breadcrumb_schema_missing",
  problem: "Deeper pages show a bare address in Google",
  category: C,
  title: "Deeper pages have BreadcrumbList schema",
  description: "Breadcrumbs show the site structure in results and help engines group service pages.",
  severity: "low",
  impact: 15,
  fix: "easy",
  run: (site) => {
    const deep = site.pages.filter((p) => new URL(p.finalUrl).pathname.split("/").filter(Boolean).length >= 2);
    if (deep.length < 2) return { unavailable: "site has no nested pages" };
    const without = deep.filter((p) => !p.jsonLd.some((b) => b.types.includes("BreadcrumbList")));
    return without.length === deep.length ? { plain_english: `Your deeper pages (${deep.length}) do not tell Google where they sit in the site, so search results show a bare web address instead of a clear path like Home › Services › Water heaters.`, evidence: [ev("no BreadcrumbList on any nested page", deep[0]!.finalUrl)] } : "pass";
  },
});

siteCheck({
  id: "self_serving_rating",
  problem: "Site awards itself a star rating",
  category: C,
  title: "No self-serving aggregateRating",
  description: "Google treats star ratings a business marks up about itself as spam and can drop the rich result for the whole site.",
  severity: "medium",
  impact: 40,
  fix: "easy",
  run: (site) => {
    const bad = site.pages.flatMap((p) => p.jsonLd.filter((b) => b.parsed && (LOCAL_TYPES.test(b.types[0] ?? "") || b.types.includes("Organization")) && field(b.parsed, "aggregateRating")).map((b) => ({ p, b })));
    return bad.length ? { plain_english: "Your site tells Google it has a star rating that it awarded itself. Google's rules do not allow this, and it can cost you the stars you have honestly earned on your listing.", evidence: bad.slice(0, 3).map(({ p, b }) => ev(JSON.stringify(field(b.parsed, "aggregateRating")).slice(0, 160), p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "sameas_missing",
  problem: "Website does not point to your Google and Yelp listings",
  category: C,
  title: "sameAs links connect your profiles",
  description: "sameAs in the schema tells Google and AI engines that the website, the Google profile, Yelp and the socials are one entity.",
  severity: "medium",
  impact: 40,
  fix: "easy",
  run: (site) => {
    const blocks = localBlocks(site.pages);
    if (!blocks.length) return { unavailable: "no LocalBusiness schema" };
    const sameAs = blocks.flatMap(({ block }) => {
      const v = field(block.parsed, "sameAs");
      return Array.isArray(v) ? v.map(String) : typeof v === "string" ? [v] : [];
    });
    if (!sameAs.length) return { plain_english: "Your website does not point Google to your Google listing, Yelp page or social profiles, so Google is less sure they all belong to the same business.", evidence: [ev("sameAs absent", blocks[0]!.url)] };
    const hasGoogle = sameAs.some((u) => /google\.com\/maps|g\.page|maps\.app\.goo\.gl/.test(u));
    const hasYelp = sameAs.some((u) => /yelp\./.test(u));
    return hasGoogle || hasYelp ? "pass" : { plain_english: `Your website points to ${count(sameAs.length, "profile")} but not to your Google listing or Yelp page, the two that matter most.`, evidence: [ev(sameAs.join(", "), blocks[0]!.url)], severity: "low", impact_score: 20 };
  },
});
