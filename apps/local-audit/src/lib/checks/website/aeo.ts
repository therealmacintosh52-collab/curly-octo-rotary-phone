import { aiAgentNames, cityLabel, cityTokens, count, ev, home, listUrls, mentionsAny, pagesOfKind, siteCheck, v } from "./util";

const C = "aeo" as const;

siteCheck({
  id: "entity_statement_missing",
  problem: "Home page does not open with who, what and where",
  category: C,
  title: "Home page opens with who, what and where",
  description: "AI answer engines and Google both lift the first screen of text. It should say the business name, the service and the city in one or two plain sentences.",
  severity: "high",
  impact: 65,
  fix: "easy",
  run: (site, ctx) => {
    const h = home(site);
    const start = h.textStart.toLowerCase();
    const cities = cityTokens(ctx);
    const nameHit = start.includes(ctx.business.name.toLowerCase().split(" ")[0] ?? "");
    const cityHit = !!mentionsAny(start, cities);
    const serviceHit = (ctx.services ?? []).some((s) => start.includes(s.toLowerCase())) || /\b(plumb|electric|roof|hvac|heating|cooling|dent|law|attorney|repair|clean|landscap|paint|remodel|salon|clinic|restaurant|insur|account|real estate|tint|detail|wrap)/i.test(start);
    if (nameHit && cityHit && serviceHit) return "pass";
    const missing = [!nameHit && "the business name", !serviceHit && "what you do", !cityHit && (cities.length ? `the city (${cityLabel(ctx) ?? cities[0]})` : "the city")].filter(Boolean) as string[];
    return { plain_english: `The first thing a visitor or an AI assistant reads on your home page does not clearly say ${missing.join(", ")}. If the opening line does not say who you are, what you do and where, you are not the answer to anyone's question.`, evidence: [ev(`first text: "${h.textStart.slice(0, 240)}"`, h.finalUrl)] };
  },
});

siteCheck({
  id: "faq_content_missing",
  problem: "Site does not answer customer questions directly",
  category: C,
  title: "Site answers customer questions directly",
  description: "Question headings with short direct answers are the format ChatGPT, Gemini and Google AI Overviews prefer to quote.",
  severity: "medium",
  impact: 50,
  fix: "medium",
  run: (site) => {
    const q = site.pages.reduce((n, p) => n + p.questionHeadings.length, 0);
    return q >= 3 ? "pass" : { plain_english: `Your site answers almost no customer questions directly (${q} found across ${site.pages.length} pages). ChatGPT, Google and other assistants prefer to quote sites that ask and answer real questions.`, evidence: [ev(`question headings found: ${q}`, home(site).finalUrl)] };
  },
});

siteCheck({
  id: "answer_first_service_pages",
  problem: "Service pages bury the facts under sales copy",
  category: C,
  title: "Service pages answer first",
  description: "A service page should define the service, price range and turnaround in its first paragraph, before the sales copy.",
  severity: "medium",
  impact: 40,
  fix: "easy",
  run: (site) => {
    const services = pagesOfKind(site, "service");
    if (!services.length) return { unavailable: "no service pages found" };
    const weak = services.filter((p) => p.wordCount < 250 || !/\$|\bprice|\bcost|\bstart(ing|s)? at|\bsame[- ]day|\bwithin \d|\bhours?\b|\bdays?\b|\binclude/i.test(p.textStart));
    return weak.length ? { plain_english: `${weak.length} of ${count(services.length, "service page")} ${v(services.length, "open")} without the facts people want first (what it costs, how long it takes, what is included), or are too short to answer anything: ${listUrls(weak)}.`, evidence: weak.slice(0, 4).map((p) => ev(`${p.wordCount} words; opens: "${p.textStart.slice(0, 160)}"`, p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "credentials_missing",
  problem: "No proof you are legitimate where visitors look",
  category: C,
  title: "Credentials and trust signals are visible",
  description: "Licence numbers, insurance, years in business and named owners are what both customers and AI engines use to decide you are legitimate.",
  severity: "medium",
  impact: 45,
  fix: "easy",
  run: (site) => {
    const phrases = new Set(site.pages.flatMap((p) => p.trustPhrases));
    return phrases.size >= 2 ? "pass" : { plain_english: `Your site shows almost no proof that you are legitimate (${[...phrases].join(", ") || "nothing found"}): no licence number, insurance, years in business or owner's name where visitors can see them.`, evidence: [ev(`trust phrases across site: ${[...phrases].join(", ") || "none"}`, home(site).finalUrl)] };
  },
});

siteCheck({
  id: "about_page_missing",
  problem: "No About page",
  category: C,
  title: "An About page exists",
  description: "AI engines and Google's quality raters look for who is behind the business. An About page with real names and photos is the entity's anchor.",
  severity: "low",
  impact: 30,
  fix: "medium",
  run: (site) => (pagesOfKind(site, "about").length ? "pass" : { plain_english: "There is no About page. Customers, Google and AI assistants all look for who is behind the business before trusting it.", evidence: [ev(`page kinds crawled: ${[...new Set(Object.values(site.kinds))].join(", ")}`, home(site).finalUrl)] }),
});

siteCheck({
  id: "llms_txt_missing",
  problem: "No summary file for AI assistants",
  category: C,
  title: "llms.txt is present",
  description: "An emerging convention: a plain-text summary of the site for AI crawlers. Low weight today, cheap to add.",
  severity: "low",
  impact: 5,
  fix: "easy",
  run: (site) => (site.llmsTxt.status === "unavailable" ? { unavailable: "could not probe /llms.txt" } : site.llmsTxt.status === "present" ? "pass" : { plain_english: "Your site has no summary file for AI assistants. It is optional and minor, but it costs nothing and some assistants read it.", evidence: [ev("GET /llms.txt → missing", `${new URL(site.canonicalUrl).origin}/llms.txt`)] }),
});

siteCheck({
  id: "ai_crawlers_blocked",
  problem: "AI assistants are blocked from reading your site",
  category: C,
  title: "AI crawlers are allowed",
  description: "robots.txt rules that block GPTBot, ClaudeBot, PerplexityBot or Google-Extended remove the business from those assistants' answers.",
  severity: "high",
  impact: 60,
  fix: "easy",
  run: (site) => (site.robots.status !== "ok" ? { unavailable: "no robots.txt" } : site.robots.blockedAgents.length ? { plain_english: `Your site tells ${aiAgentNames(site.robots.blockedAgents)} to stay out. They cannot read your site, so when someone asks them for a business like yours they recommend a competitor.`, evidence: [ev(site.robots.text!.slice(0, 400), `${new URL(site.canonicalUrl).origin}/robots.txt`)] } : "pass"),
});

siteCheck({
  id: "extractable_structure",
  problem: "Home page is one long block of text",
  category: C,
  title: "Content uses lists and sections engines can extract",
  description: "Walls of text are skipped; short sections with headings, lists and tables get quoted.",
  severity: "low",
  impact: 25,
  fix: "easy",
  run: (site) => {
    const h = home(site);
    const sections = h.headings.filter((x) => x.level === 2 || x.level === 3).length;
    return h.wordCount > 250 && sections < 2 ? { plain_english: `Your home page is ${h.wordCount} words with ${count(sections, "sub-heading")}, one long block. Readers skim and leave, and AI assistants skip pages they cannot break into parts.`, evidence: [ev(`${h.wordCount} words, ${sections} H2/H3 headings`, h.finalUrl)] } : "pass";
  },
});
