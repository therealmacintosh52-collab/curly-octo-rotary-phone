import { ev, home, keyPages, listUrls, shortUrl, siteCheck } from "./util";

const C = "technical_seo" as const;

siteCheck({
  id: "https_missing",
  problem: "Site is not served over HTTPS",
  category: C,
  title: "Site is served over HTTPS",
  description: "Browsers mark HTTP sites 'Not secure', and Google prefers HTTPS. A local business with a padlock missing loses trust before the first word.",
  severity: "critical",
  impact: 90,
  fix: "easy",
  run: (site) => (site.https ? "pass" : { plain_english: `The site loads over plain HTTP (${site.canonicalUrl}). Browsers show 'Not secure' next to the address and Chrome may block form submissions.`, evidence: [ev(`canonical URL ${site.canonicalUrl}`, site.canonicalUrl)] }),
});

siteCheck({
  id: "mixed_content",
  problem: "Insecure resources on secure pages",
  category: C,
  title: "No insecure resources on secure pages",
  description: "HTTP images or scripts on an HTTPS page break the padlock and are blocked by browsers.",
  severity: "medium",
  impact: 45,
  fix: "easy",
  run: (site) => {
    const bad = site.pages.filter((p) => p.mixedContent.length);
    return bad.length ? { plain_english: `${bad.length} page(s) load images or scripts over plain HTTP, so the padlock is broken and some of them are blocked outright.`, evidence: bad.slice(0, 5).map((p) => ev(p.mixedContent.slice(0, 3).join(", "), p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "title_missing",
  problem: "Pages without a title tag",
  category: C,
  title: "Every page has a title tag",
  description: "The title is the blue link in Google. Without one, Google invents it.",
  severity: "high",
  impact: 70,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).filter((p) => !p.title);
    return bad.length ? { plain_english: `${bad.length} page(s) have no <title>: ${listUrls(bad)}.`, evidence: bad.slice(0, 5).map((p) => ev("no <title> element", p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "title_length",
  problem: "Titles too long or too short for a search result",
  category: C,
  title: "Titles fit in a search result",
  description: "Titles over ~60 characters get cut off; under ~25 they waste the space Google gives you.",
  severity: "low",
  impact: 30,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).filter((p) => p.title && (p.title.length > 65 || p.title.length < 25));
    return bad.length ? { plain_english: `${bad.length} page title(s) are too long or too short to read well in search results: ${listUrls(bad)}.`, evidence: bad.slice(0, 5).map((p) => ev(`${p.title!.length} chars: "${p.title}"`, p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "title_duplicate",
  problem: "Several pages share the same title",
  category: C,
  title: "Page titles are unique",
  description: "Two pages with the same title compete with each other and neither ranks well.",
  severity: "medium",
  impact: 50,
  fix: "easy",
  run: (site) => {
    const groups = new Map<string, string[]>();
    for (const p of keyPages(site)) if (p.title) groups.set(p.title.trim().toLowerCase(), [...(groups.get(p.title.trim().toLowerCase()) ?? []), p.finalUrl]);
    const dupes = [...groups.entries()].filter(([, urls]) => urls.length > 1);
    return dupes.length ? { plain_english: `${dupes.length} title(s) are reused on more than one page.`, evidence: dupes.slice(0, 5).map(([t, urls]) => ev(`"${t}" on ${urls.map(shortUrl).join(", ")}`, urls[0])) } : "pass";
  },
});

siteCheck({
  id: "title_generic",
  problem: "Home page title does not say what and where",
  category: C,
  title: "Home page title says what and where",
  description: "'Home' or the bare business name tells Google nothing about the service or the city.",
  severity: "high",
  impact: 65,
  fix: "easy",
  run: (site, ctx) => {
    const t = home(site).title ?? "";
    const generic = /^(home|welcome|index|untitled|new page)$/i.test(t.trim()) || t.trim().toLowerCase() === ctx.business.name.toLowerCase();
    return generic ? { plain_english: `The home page title is "${t}". It should name the main service and the city, for example "Sacramento Plumber | ${ctx.business.name}".`, evidence: [ev(`<title>${t}</title>`, home(site).finalUrl)] } : "pass";
  },
});

siteCheck({
  id: "meta_description_missing",
  problem: "Pages without a meta description",
  category: C,
  title: "Every page has a meta description",
  description: "The description is the grey text under the blue link. It does not affect ranking but decides whether people click.",
  severity: "medium",
  impact: 45,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).filter((p) => !p.metaDescription);
    return bad.length ? { plain_english: `${bad.length} of ${keyPages(site).length} page(s) have no meta description, so Google picks random text from the page: ${listUrls(bad)}.`, evidence: bad.slice(0, 5).map((p) => ev("no <meta name=description>", p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "meta_description_length",
  problem: "Meta descriptions the wrong length",
  category: C,
  title: "Meta descriptions are the right length",
  description: "Over ~160 characters gets truncated; under ~70 looks thin next to competitors.",
  severity: "low",
  impact: 20,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).filter((p) => p.metaDescription && (p.metaDescription.length > 170 || p.metaDescription.length < 60));
    return bad.length ? { plain_english: `${bad.length} meta description(s) are outside the 70–160 character range: ${listUrls(bad)}.`, evidence: bad.slice(0, 5).map((p) => ev(`${p.metaDescription!.length} chars`, p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "meta_description_duplicate",
  problem: "Several pages share the same meta description",
  category: C,
  title: "Meta descriptions are unique",
  description: "A copied description across pages is ignored by Google.",
  severity: "low",
  impact: 25,
  fix: "easy",
  run: (site) => {
    const groups = new Map<string, string[]>();
    for (const p of keyPages(site)) if (p.metaDescription) groups.set(p.metaDescription.trim(), [...(groups.get(p.metaDescription.trim()) ?? []), p.finalUrl]);
    const dupes = [...groups.values()].filter((urls) => urls.length > 1);
    return dupes.length ? { plain_english: `${dupes.length} meta description(s) are copied across pages.`, evidence: dupes.slice(0, 5).map((urls) => ev(urls.map(shortUrl).join(", "), urls[0])) } : "pass";
  },
});

siteCheck({
  id: "h1_missing",
  problem: "Pages without an H1",
  category: C,
  title: "Every page has one H1",
  description: "The H1 is the page's headline for search engines and screen readers.",
  severity: "medium",
  impact: 50,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).filter((p) => p.h1s.length === 0);
    return bad.length ? { plain_english: `${bad.length} page(s) have no H1 heading: ${listUrls(bad)}.`, evidence: bad.slice(0, 5).map((p) => ev("no <h1>", p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "h1_multiple",
  problem: "Pages with several H1s",
  category: C,
  title: "Pages do not have several H1s",
  description: "Several H1s dilute the page's topic; theme builders do this by accident.",
  severity: "low",
  impact: 25,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).filter((p) => p.h1s.length > 1);
    return bad.length ? { plain_english: `${bad.length} page(s) have more than one H1: ${listUrls(bad)}.`, evidence: bad.slice(0, 5).map((p) => ev(p.h1s.map((h) => `"${h}"`).join(" / "), p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "heading_order",
  problem: "Headings skip levels",
  category: C,
  title: "Headings follow a logical order",
  description: "Skipping from H1 to H3 or starting a page at H3 confuses outline readers and AI extractors.",
  severity: "low",
  impact: 20,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).filter((p) => {
      let prev = 0;
      for (const h of p.headings) {
        if (h.level > prev + 1 && prev !== 0) return true;
        if (prev === 0 && h.level > 2) return true;
        prev = h.level;
      }
      return false;
    });
    return bad.length ? { plain_english: `${bad.length} page(s) skip heading levels (for example H1 straight to H3): ${listUrls(bad)}.`, evidence: bad.slice(0, 5).map((p) => ev(p.headings.map((h) => `h${h.level}`).join(" → "), p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "canonical_missing",
  problem: "Pages without a canonical URL",
  category: C,
  title: "Pages declare a canonical URL",
  description: "Without a canonical tag, www/non-www and query-string variants split ranking signals.",
  severity: "low",
  impact: 30,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).filter((p) => !p.canonical);
    return bad.length === keyPages(site).length ? { plain_english: "No page declares a canonical URL. Add <link rel=\"canonical\"> to every page so duplicate URLs point at one address.", evidence: bad.slice(0, 3).map((p) => ev("no rel=canonical", p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "canonical_cross_host",
  problem: "Canonical tags point at another site",
  category: C,
  title: "Canonical tags point at this site",
  description: "A canonical pointing to another domain (a template leftover or an old domain) hands your ranking away.",
  severity: "high",
  impact: 70,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).filter((p) => {
      if (!p.canonical) return false;
      try {
        return new URL(p.canonical, p.finalUrl).hostname.replace(/^www\./, "") !== site.host;
      } catch {
        return false;
      }
    });
    return bad.length ? { plain_english: `${bad.length} page(s) declare a canonical URL on a different domain: ${listUrls(bad)}.`, evidence: bad.slice(0, 5).map((p) => ev(`canonical → ${p.canonical}`, p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "noindex_key_page",
  problem: "Important pages are set to noindex",
  category: C,
  title: "Important pages are indexable",
  description: "A 'noindex' left on a service or contact page removes it from Google entirely.",
  severity: "critical",
  impact: 85,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).filter((p) => p.robotsMeta && /noindex/.test(p.robotsMeta));
    return bad.length ? { plain_english: `${bad.length} page(s) tell Google not to index them: ${listUrls(bad)}. If that is not deliberate, they are invisible in search.`, evidence: bad.slice(0, 5).map((p) => ev(`<meta name=robots content="${p.robotsMeta}">`, p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "robots_txt_missing",
  problem: "No robots.txt",
  category: C,
  title: "robots.txt exists",
  description: "Not fatal, but a missing robots.txt means no sitemap pointer and no control over crawlers.",
  severity: "low",
  impact: 15,
  fix: "easy",
  run: (site) => (site.robots.status === "unavailable" ? { unavailable: "robots.txt could not be fetched" } : site.robots.status === "missing" ? { plain_english: "There is no robots.txt. Add one that allows crawling and points at the sitemap.", evidence: [ev("GET /robots.txt did not return a robots file", `${new URL(site.canonicalUrl).origin}/robots.txt`)] } : "pass"),
});

siteCheck({
  id: "robots_txt_blocks_all",
  problem: "robots.txt blocks search engines",
  category: C,
  title: "robots.txt does not block search engines",
  description: "A 'Disallow: /' for everyone keeps Google out of the whole site. It happens after a redesign more often than you would think.",
  severity: "critical",
  impact: 100,
  fix: "easy",
  run: (site) => (site.robots.status !== "ok" ? { unavailable: "no robots.txt to evaluate" } : site.robots.blocksAll ? { plain_english: "robots.txt disallows the entire site for all crawlers. Nothing here can rank until that line is removed.", evidence: [ev(site.robots.text!.slice(0, 300), `${new URL(site.canonicalUrl).origin}/robots.txt`)] } : "pass"),
});

siteCheck({
  id: "sitemap_missing",
  problem: "No XML sitemap",
  category: C,
  title: "An XML sitemap exists",
  description: "The sitemap tells Google every page you want indexed, including new service pages.",
  severity: "medium",
  impact: 40,
  fix: "easy",
  run: (site) => (site.sitemap.status === "unavailable" ? { unavailable: "sitemap could not be fetched" } : site.sitemap.status === "missing" || site.sitemap.status === "invalid" ? { plain_english: site.sitemap.status === "invalid" ? `The sitemap at ${shortUrl(site.sitemap.url!)} is not valid XML.` : "No XML sitemap was found at /sitemap.xml or via robots.txt.", evidence: [ev(`sitemap status: ${site.sitemap.status}`, site.sitemap.url ?? `${new URL(site.canonicalUrl).origin}/sitemap.xml`)] } : "pass"),
});

siteCheck({
  id: "sitemap_not_in_robots",
  problem: "robots.txt does not point at the sitemap",
  category: C,
  title: "robots.txt points at the sitemap",
  description: "The Sitemap: line is how crawlers other than Google find your sitemap.",
  severity: "low",
  impact: 15,
  fix: "easy",
  run: (site) => (site.robots.status !== "ok" || site.sitemap.status !== "ok" ? { unavailable: "needs both robots.txt and a sitemap" } : site.robots.sitemaps.length ? "pass" : { plain_english: "robots.txt exists but does not list the sitemap. Add a Sitemap: line.", evidence: [ev(site.robots.text!.slice(0, 200), `${new URL(site.canonicalUrl).origin}/robots.txt`)] }),
});

siteCheck({
  id: "sitemap_broken_urls",
  problem: "Sitemap lists URLs that do not resolve",
  category: C,
  title: "Sitemap URLs resolve",
  description: "Dead URLs in the sitemap waste crawl budget and signal neglect.",
  severity: "medium",
  impact: 35,
  fix: "easy",
  run: (site) => (site.sitemap.status !== "ok" ? { unavailable: "no sitemap" } : site.sitemap.brokenSample.length ? { plain_english: `${site.sitemap.brokenSample.length} of the sampled sitemap URLs answer with an error.`, evidence: site.sitemap.brokenSample.map((b) => ev(`HTTP ${b.status}`, b.url)) } : "pass"),
});

siteCheck({
  id: "broken_internal_links",
  problem: "Broken internal links",
  category: C,
  title: "Internal links work",
  description: "Links to missing pages lose visitors and leak ranking signals.",
  severity: "medium",
  impact: 50,
  fix: "easy",
  run: (site) => {
    const bad = site.linkProbes.filter((l) => l.status >= 400 && l.foundOn.length > 0);
    return bad.length ? { plain_english: `${bad.length} internal link(s) point at pages that answer with an error.`, evidence: bad.slice(0, 8).map((l) => ev(`HTTP ${l.status} for ${shortUrl(l.url)} (linked from ${l.foundOn.slice(0, 2).map(shortUrl).join(", ")})`, l.url)) } : "pass";
  },
});

siteCheck({
  id: "redirect_chains",
  problem: "Internal links hop through redirects",
  category: C,
  title: "Internal links do not hop through redirects",
  description: "Each redirect hop slows the page and loses a little ranking signal; chains of two or more are pure waste.",
  severity: "low",
  impact: 25,
  fix: "easy",
  run: (site) => {
    const chains = site.linkProbes.filter((l) => l.redirectChain.length >= 3);
    const singles = site.linkProbes.filter((l) => l.redirectChain.length === 2 && l.foundOn.length);
    if (chains.length) return { plain_english: `${chains.length} internal link(s) go through two or more redirects before landing.`, evidence: chains.slice(0, 5).map((l) => ev(l.redirectChain.map(shortUrl).join(" → "), l.url)) };
    if (singles.length >= 3) return { plain_english: `${singles.length} internal links point at redirecting URLs. Link straight to the final address.`, evidence: singles.slice(0, 5).map((l) => ev(l.redirectChain.map(shortUrl).join(" → "), l.url)), severity: "low", impact_score: 15 };
    return "pass";
  },
});

siteCheck({
  id: "soft_404",
  problem: "Missing pages return 200 instead of 404",
  category: C,
  title: "Missing pages return a real 404",
  description: "A site that answers 200 for pages that do not exist confuses Google about which URLs are real.",
  severity: "medium",
  impact: 35,
  fix: "medium",
  run: (site) => (site.softNotFound.isSoft404 === null ? { unavailable: "could not probe a missing URL" } : site.softNotFound.isSoft404 ? { plain_english: "A URL that cannot exist was answered with 200 OK instead of 404. Google may index junk URLs and treat real pages as duplicates.", evidence: [ev(`GET ${site.softNotFound.probedPath} → ${site.softNotFound.status}`, `${new URL(site.canonicalUrl).origin}${site.softNotFound.probedPath}`)] } : "pass"),
});

siteCheck({
  id: "viewport_missing",
  problem: "Pages are not mobile-ready (no viewport)",
  category: C,
  title: "Pages are mobile-ready (viewport)",
  description: "Without a viewport meta tag, phones render the desktop layout shrunk down.",
  severity: "high",
  impact: 70,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).filter((p) => !p.viewport);
    return bad.length ? { plain_english: `${bad.length} page(s) have no viewport meta tag, so they are unreadable on phones without zooming: ${listUrls(bad)}.`, evidence: bad.slice(0, 5).map((p) => ev("no <meta name=viewport>", p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "lang_missing",
  problem: "Pages do not declare their language",
  category: C,
  title: "Pages declare their language",
  description: "<html lang> helps screen readers and search engines; it is a one-line fix.",
  severity: "low",
  impact: 10,
  fix: "easy",
  run: (site) => (home(site).lang ? "pass" : { plain_english: "The <html> tag has no lang attribute.", evidence: [ev('<html> without lang="en"', home(site).finalUrl)] }),
});

siteCheck({
  id: "favicon_missing",
  problem: "No favicon",
  category: C,
  title: "Site has a favicon",
  description: "Google shows the favicon in mobile results; a missing one looks unfinished.",
  severity: "low",
  impact: 15,
  fix: "easy",
  run: (site) => (home(site).hasFavicon ? "pass" : { plain_english: "No favicon is declared, so search results and browser tabs show a blank icon.", evidence: [ev("no <link rel=icon>", home(site).finalUrl)] }),
});

siteCheck({
  id: "html_oversized",
  problem: "Bloated HTML pages",
  category: C,
  title: "Pages are not bloated",
  description: "HTML over ~500 KB usually means inlined page-builder CSS and slows every visit.",
  severity: "low",
  impact: 25,
  fix: "medium",
  run: (site) => {
    const bad = site.pages.filter((p) => p.htmlBytes > 500_000);
    return bad.length ? { plain_english: `${bad.length} page(s) exceed 500 KB of HTML: ${listUrls(bad)}.`, evidence: bad.slice(0, 5).map((p) => ev(`${Math.round(p.htmlBytes / 1024)} KB of HTML`, p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "script_bloat",
  problem: "Pages load excessive scripts",
  category: C,
  title: "Pages do not load excessive scripts",
  description: "Dozens of third-party scripts are the usual cause of a slow, janky mobile site.",
  severity: "low",
  impact: 30,
  fix: "medium",
  run: (site) => {
    const h = home(site);
    return h.scripts.external > 25 ? { plain_english: `The home page loads ${h.scripts.external} external scripts. Each one is a network round-trip before the page becomes usable.`, evidence: [ev(`${h.scripts.external} external <script src> tags, ${Math.round(h.scripts.inlineBytes / 1024)} KB inline`, h.finalUrl)] } : "pass";
  },
});

siteCheck({
  id: "blocked_pages",
  problem: "Site blocks automated visitors",
  category: C,
  title: "The site allows automated visitors",
  description: "If our crawler is walled off, so are some search and AI crawlers. We do not bypass bot protection.",
  severity: "medium",
  impact: 40,
  fix: "medium",
  run: (site) => {
    const blocked = site.failures.filter((f) => f.reason === "blocked");
    return blocked.length ? { plain_english: `${blocked.length} page(s) refused automated requests (403/429/503 or robots.txt). We reported this rather than working around it; check the bot-protection settings.`, evidence: blocked.slice(0, 5).map((f) => ev(f.message, f.url)) } : "pass";
  },
});

siteCheck({
  id: "crawl_errors",
  problem: "Pages fail to load",
  category: C,
  title: "Pages load reliably",
  description: "Timeouts and connection errors during a normal crawl mean real visitors see them too.",
  severity: "medium",
  impact: 45,
  fix: "medium",
  run: (site) => {
    const errs = site.failures.filter((f) => f.reason === "timeout" || f.reason === "network");
    return errs.length ? { plain_english: `${errs.length} page(s) timed out or failed to load during the crawl.`, evidence: errs.slice(0, 5).map((f) => ev(`${f.reason}: ${f.message}`, f.url)) } : "pass";
  },
});

// ---- PageSpeed-backed --------------------------------------------------------

siteCheck({
  id: "psi_performance_mobile",
  problem: "Poor mobile performance score",
  category: C,
  title: "Mobile performance score is healthy",
  description: "Google's PageSpeed score summarises how fast the page feels on a mid-range phone.",
  severity: "high",
  impact: 70,
  fix: "hard",
  run: (site, ctx) => {
    const m = ctx.pagespeed?.mobile;
    if (!m || m.performanceScore === null) return { unavailable: "PageSpeed mobile result not available" };
    if (m.performanceScore >= 90) return "pass";
    const poor = m.performanceScore < 50;
    return {
      plain_english: `PageSpeed rates the mobile home page ${m.performanceScore}/100 (${poor ? "poor" : "needs improvement"}). ${m.opportunities.length ? `Biggest levers: ${m.opportunities.slice(0, 3).map((o) => o.id.replace(/-/g, " ")).join(", ")}.` : ""}`,
      evidence: [ev(`performance ${m.performanceScore}/100; LCP ${m.lab.lcpMs ?? "?"} ms; TBT ${m.lab.tbtMs ?? "?"} ms; ${m.opportunities.map((o) => `${o.id}${o.displayValue ? ` (${o.displayValue})` : ""}`).join("; ")}`, home(site).finalUrl, "api_field")],
      severity: poor ? "high" : "medium",
      impact_score: poor ? 70 : 45,
    };
  },
});

siteCheck({
  id: "psi_lcp",
  problem: "Largest Contentful Paint over 2.5 s",
  category: C,
  title: "Largest Contentful Paint under 2.5 s",
  description: "LCP is when the main content appears. Over 4 s on mobile, a large share of visitors leave before it does.",
  severity: "high",
  impact: 65,
  fix: "medium",
  run: (site, ctx) => {
    const m = ctx.pagespeed?.mobile;
    const lcp = m?.field.lcpMs ?? m?.lab.lcpMs ?? null;
    if (lcp === null) return { unavailable: "no LCP measurement" };
    if (lcp <= 2_500) return "pass";
    const poor = lcp > 4_000;
    return { plain_english: `The main content takes ${(lcp / 1000).toFixed(1)} s to appear on mobile (${m?.field.lcpMs ? "real-user data" : "lab test"}). Good is under 2.5 s.`, evidence: [ev(`LCP ${lcp} ms (${m?.field.lcpMs ? "CrUX field" : "Lighthouse lab"})`, home(site).finalUrl, "api_field")], severity: poor ? "high" : "medium", impact_score: poor ? 65 : 40 };
  },
});

siteCheck({
  id: "psi_inp",
  problem: "Interaction to Next Paint over 200 ms",
  category: C,
  title: "Interaction to Next Paint under 200 ms",
  description: "INP measures how quickly taps respond. Slow INP feels like a frozen site.",
  severity: "medium",
  impact: 40,
  fix: "medium",
  run: (site, ctx) => {
    const inp = ctx.pagespeed?.mobile?.field.inpMs ?? null;
    if (inp === null) return { unavailable: "no field INP data (site may have too little traffic for CrUX)" };
    if (inp <= 200) return "pass";
    return { plain_english: `Taps take ${inp} ms to respond for real mobile visitors. Good is under 200 ms.`, evidence: [ev(`INP p75 ${inp} ms (CrUX)`, home(site).finalUrl, "api_field")], severity: inp > 500 ? "high" : "medium" };
  },
});

siteCheck({
  id: "psi_cls",
  problem: "Layout shifts while loading",
  category: C,
  title: "Layout does not shift while loading",
  description: "Content jumping as images and ads load causes mis-taps and is a ranking signal.",
  severity: "medium",
  impact: 40,
  fix: "medium",
  run: (site, ctx) => {
    const m = ctx.pagespeed?.mobile;
    const cls = m?.field.cls ?? m?.lab.clsScore ?? null;
    if (cls === null) return { unavailable: "no CLS measurement" };
    if (cls <= 0.1) return "pass";
    return { plain_english: `The page shifts around while loading (CLS ${cls.toFixed(2)}; good is under 0.10). Usually images without width/height or late-loading banners.`, evidence: [ev(`CLS ${cls.toFixed(3)}`, home(site).finalUrl, "api_field")], severity: cls > 0.25 ? "medium" : "low" };
  },
});

siteCheck({
  id: "psi_ttfb",
  problem: "Slow server response",
  category: C,
  title: "Server responds quickly",
  description: "Time to first byte over 800 ms means slow hosting or no caching, and every page waits on it.",
  severity: "medium",
  impact: 40,
  fix: "medium",
  run: (site, ctx) => {
    const m = ctx.pagespeed?.mobile;
    const ttfb = m?.field.ttfbMs ?? m?.lab.ttfbMs ?? null;
    if (ttfb === null) return { unavailable: "no TTFB measurement" };
    if (ttfb <= 800) return "pass";
    return { plain_english: `The server takes ${ttfb} ms to start responding. Good hosting with caching answers in under 800 ms.`, evidence: [ev(`TTFB ${ttfb} ms`, home(site).finalUrl, "api_field")] };
  },
});

siteCheck({
  id: "psi_desktop_gap",
  problem: "Poor performance even on desktop",
  category: C,
  title: "Desktop performance is acceptable",
  description: "Desktop is more forgiving; a low desktop score points at server or asset problems, not just phones.",
  severity: "low",
  impact: 25,
  fix: "medium",
  run: (site, ctx) => {
    const d = ctx.pagespeed?.desktop;
    if (!d || d.performanceScore === null) return { unavailable: "PageSpeed desktop result not available" };
    return d.performanceScore < 70 ? { plain_english: `Even on desktop, PageSpeed rates the home page ${d.performanceScore}/100.`, evidence: [ev(`desktop performance ${d.performanceScore}/100`, home(site).finalUrl, "api_field")] } : "pass";
  },
});

siteCheck({
  id: "js_dependent_content",
  problem: "Content only appears with JavaScript",
  category: C,
  title: "Content is present without JavaScript",
  description: "If the HTML has almost no text and a pile of scripts, crawlers that do not run JavaScript (most AI crawlers) see an empty page.",
  severity: "medium",
  impact: 45,
  fix: "hard",
  run: (site) => {
    const h = home(site);
    return h.wordCount < 60 && h.scripts.external >= 3 ? { plain_english: `The home page ships only ${h.wordCount} words of text in its HTML and relies on ${h.scripts.external} scripts to render. Search and AI crawlers that do not execute JavaScript see almost nothing.`, evidence: [ev(`${h.wordCount} words in static HTML; ${h.scripts.external} external scripts`, h.finalUrl)] } : "pass";
  },
});
