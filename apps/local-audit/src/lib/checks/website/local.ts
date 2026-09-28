import { cityTokens, ev, home, keyPages, listUrls, mentionsAny, pagesOfKind, pct, serviceTokens, siteCheck, mentionsService } from "./util";

const C = "local_onsite" as const;

siteCheck({
  id: "phone_in_header",
  problem: "Phone number is not in the header",
  category: C,
  title: "Phone number in the header",
  description: "The number belongs at the top of every page; most local visitors are looking for it.",
  severity: "high",
  impact: 70,
  fix: "easy",
  run: (site) => {
    const h = home(site);
    const inHeader = /\(?\b[2-9]\d{2}\)?[\s.-]?[2-9]\d{2}[\s.-]?\d{4}\b/.test(h.headerText) || h.links.some((l) => l.region === "header") && h.telLinks.length > 0 && h.headerText.length > 0 && /\d{3}.*\d{4}/.test(h.headerText);
    return inHeader ? "pass" : { plain_english: "The phone number is not in the site header. Visitors on phones should be able to call from the first screen of any page.", evidence: [ev(`header text: "${h.headerText.slice(0, 160)}"`, h.finalUrl)] };
  },
});

siteCheck({
  id: "nap_site_wide",
  problem: "Name, address and phone are not on every page",
  category: C,
  title: "Name, address and phone on every page",
  description: "Google reads the footer of every page. A consistent NAP block there is the cheapest local ranking signal.",
  severity: "medium",
  impact: 55,
  fix: "easy",
  run: (site) => {
    const pages = keyPages(site);
    const withPhone = pages.filter((p) => p.phones.length || p.telLinks.length).length;
    const withAddress = pages.filter((p) => p.addresses.length || p.hasAddressTag).length;
    const phonePct = pct(withPhone, pages.length);
    const addrPct = pct(withAddress, pages.length);
    if (phonePct >= 90 && addrPct >= 90) return "pass";
    return { plain_english: `Only ${phonePct}% of pages show a phone number and ${addrPct}% show the street address. Put the full NAP block in the footer so it appears everywhere.`, evidence: [ev(`phone on ${withPhone}/${pages.length} pages; address on ${withAddress}/${pages.length}`, home(site).finalUrl)] };
  },
});

siteCheck({
  id: "address_missing",
  problem: "Street address does not appear on the site",
  category: C,
  title: "Street address appears on the site",
  description: "A local business with no address on its website struggles to rank in the map pack and looks less real to customers.",
  severity: "high",
  impact: 65,
  fix: "easy",
  run: (site) => (site.pages.some((p) => p.addresses.length) ? "pass" : { plain_english: "No street address was found on any crawled page. Service-area businesses can show the city and service area instead, but something must be there.", evidence: [ev(`${site.pages.length} pages crawled, no street address pattern found`, home(site).finalUrl)] }),
});

siteCheck({
  id: "map_embed_missing",
  problem: "No map on the contact page",
  category: C,
  title: "A map is embedded on the contact page",
  description: "An embedded Google map reinforces the location for visitors and for Google.",
  severity: "low",
  impact: 20,
  fix: "easy",
  run: (site) => {
    const contact = pagesOfKind(site, "contact");
    const anyMap = site.pages.some((p) => p.hasMapEmbed);
    return anyMap ? "pass" : { plain_english: `No map embed found${contact.length ? " on the contact page" : " on any page"}. Embed the Google Business Profile map on the contact page.`, evidence: [ev("no Google/Apple Maps iframe or Maps JS on any crawled page", contact[0]?.finalUrl ?? home(site).finalUrl)] };
  },
});

siteCheck({
  id: "hours_missing",
  problem: "Opening hours are not shown",
  category: C,
  title: "Opening hours are shown",
  description: "Customers check hours before calling; Google and AI engines lift them from the site when the profile is incomplete.",
  severity: "medium",
  impact: 40,
  fix: "easy",
  run: (site) => (site.pages.some((p) => p.hoursMentioned) ? "pass" : { plain_english: "No opening hours were found on any page. Add them to the footer or contact page (and to the LocalBusiness schema).", evidence: [ev("no hours pattern or openingHours schema on crawled pages", home(site).finalUrl)] }),
});

siteCheck({
  id: "service_area_page_missing",
  problem: "No service-area or locations page",
  category: C,
  title: "A service-area or locations page exists",
  description: "A page that names the towns you serve is what ranks for 'plumber in Elk Grove' searches.",
  severity: "medium",
  impact: 50,
  fix: "medium",
  run: (site, ctx) => {
    if (pagesOfKind(site, "location").length) return "pass";
    const cities = cityTokens(ctx);
    const mentionedSomewhere = cities.length && site.pages.some((p) => mentionsAny(p.text, cities));
    return { plain_english: `There is no service-area or locations page. ${mentionedSomewhere ? "The city is mentioned in passing, but a dedicated page listing every town you serve ranks for nearby-city searches." : "Nearby-city searches have nothing to land on."}`, evidence: [ev(`page kinds crawled: ${[...new Set(Object.values(site.kinds))].join(", ")}`, home(site).finalUrl)] };
  },
});

siteCheck({
  id: "city_in_home_title",
  problem: "Home page title does not name the city",
  category: C,
  title: "Home page title names the city",
  description: "'Plumber' ranks nowhere; 'Sacramento plumber' ranks locally. The title is the strongest on-page signal.",
  severity: "high",
  impact: 65,
  fix: "easy",
  run: (site, ctx) => {
    const cities = cityTokens(ctx);
    if (!cities.length) return { unavailable: "no city known for this business" };
    const t = home(site).title ?? "";
    return mentionsAny(t, cities) ? "pass" : { plain_english: `The home page title ("${t}") does not mention ${cities[0]}. Add the city next to the main service.`, evidence: [ev(`<title>${t}</title>; city: ${cities[0]}`, home(site).finalUrl)] };
  },
});

siteCheck({
  id: "city_in_home_h1",
  problem: "Home page headline does not name the city",
  category: C,
  title: "Home page headline names the city",
  description: "The H1 should tell a visitor (and Google) what you do and where in one line.",
  severity: "medium",
  impact: 45,
  fix: "easy",
  run: (site, ctx) => {
    const cities = cityTokens(ctx);
    if (!cities.length) return { unavailable: "no city known for this business" };
    const h1 = home(site).h1s.join(" ");
    return mentionsAny(h1, cities) ? "pass" : { plain_english: `The home page H1 ("${h1 || "none"}") does not name ${cities[0]}.`, evidence: [ev(`h1: ${h1 || "(none)"}`, home(site).finalUrl)] };
  },
});

siteCheck({
  id: "service_city_targeting",
  problem: "Service pages do not target service + city",
  category: C,
  title: "Service pages target service + city",
  description: "Each service page should carry '<service> in <city>' in its title; that is how one page ranks for one money keyword.",
  severity: "medium",
  impact: 50,
  fix: "easy",
  run: (site, ctx) => {
    const cities = cityTokens(ctx);
    const services = pagesOfKind(site, "service");
    if (!services.length) return { unavailable: "no service pages found" };
    if (!cities.length) return { unavailable: "no city known for this business" };
    const bad = services.filter((p) => !mentionsAny(`${p.title ?? ""} ${p.h1s.join(" ")}`, cities));
    return bad.length ? { plain_english: `${bad.length} of ${services.length} service page(s) never name the city in their title or headline: ${listUrls(bad)}.`, evidence: bad.slice(0, 5).map((p) => ev(`title: "${p.title}"`, p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "services_without_pages",
  problem: "Main services have no page of their own",
  category: C,
  title: "Each main service has its own page",
  description: "A service that only exists as a bullet on the home page cannot rank for its own searches.",
  severity: "medium",
  impact: 55,
  fix: "medium",
  run: (site, ctx) => {
    const wanted = serviceTokens(ctx);
    if (!wanted.length) return { unavailable: "no services listed for this business" };
    const missing = wanted.filter((svc) => !site.pages.some((p) => p.finalUrl !== site.canonicalUrl && mentionsService(`${p.title ?? ""} ${p.h1s.join(" ")} ${p.finalUrl}`, svc)));
    return missing.length ? { plain_english: `No dedicated page was found for: ${missing.join(", ")}. Each should get its own URL, title and H1.`, evidence: [ev(`services listed: ${wanted.join(", ")}; pages crawled: ${site.pages.length}`, home(site).finalUrl)] } : "pass";
  },
});
