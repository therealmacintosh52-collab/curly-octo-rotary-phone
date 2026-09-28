import { count, describeOpportunity, ev, home, keyPages, listUrls, shortUrl, siteCheck, v } from "./util";

const C = "technical_seo" as const;

siteCheck({
  id: "https_missing",
  problem: "Your site is not secure (no padlock)",
  category: C,
  title: "Site is served over HTTPS",
  description: "Browsers mark HTTP sites 'Not secure', and Google prefers HTTPS. A local business with a padlock missing loses trust before the first word.",
  severity: "critical",
  impact: 90,
  fix: "easy",
  run: (site) => (site.https ? "pass" : { plain_english: `Your website (${site.canonicalUrl}) is not secure. Browsers put a "Not secure" warning next to your address, and many customers close the page when they see it.`, evidence: [ev(`canonical URL ${site.canonicalUrl}`, site.canonicalUrl)] }),
});

siteCheck({
  id: "mixed_content",
  problem: "Padlock broken by insecure files",
  category: C,
  title: "No insecure resources on secure pages",
  description: "HTTP images or scripts on an HTTPS page break the padlock and are blocked by browsers.",
  severity: "medium",
  impact: 45,
  fix: "easy",
  run: (site) => {
    const bad = site.pages.filter((p) => p.mixedContent.length);
    return bad.length ? { plain_english: `${count(bad.length, "page")} ${v(bad.length, "load")} some pictures or files insecurely, so the browser removes the padlock and blocks some of them. Customers see a warning instead of a trusted site.`, evidence: bad.slice(0, 5).map((p) => ev(p.mixedContent.slice(0, 3).join(", "), p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "title_missing",
  problem: "Pages with no name for Google to show",
  category: C,
  title: "Every page has a title tag",
  description: "The title is the blue link in Google. Without one, Google invents it.",
  severity: "high",
  impact: 70,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).filter((p) => !p.title);
    return bad.length ? { plain_english: `${count(bad.length, "page")} ${v(bad.length, "have")} no name for Google to show: ${listUrls(bad)}. Google makes one up, and it is rarely what you would choose.`, evidence: bad.slice(0, 5).map((p) => ev("no <title> element", p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "title_length",
  problem: "Page names too long or too short for Google",
  category: C,
  title: "Titles fit in a search result",
  description: "Titles over ~60 characters get cut off; under ~25 they waste the space Google gives you.",
  severity: "low",
  impact: 30,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).filter((p) => p.title && (p.title.length > 65 || p.title.length < 25));
    return bad.length ? { plain_english: `${count(bad.length, "page name")} ${v(bad.length, "are")} too long or too short to read in a Google result: ${listUrls(bad)}. They get cut off or say nothing.`, evidence: bad.slice(0, 5).map((p) => ev(`${p.title!.length} chars: "${p.title}"`, p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "title_duplicate",
  problem: "Several pages share the same name",
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
    return dupes.length ? { plain_english: `${count(dupes.length, "page name")} ${v(dupes.length, "are")} used on more than one page, so Google cannot tell those pages apart and customers see the same result twice.`, evidence: dupes.slice(0, 5).map(([t, urls]) => ev(`"${t}" on ${urls.map(shortUrl).join(", ")}`, urls[0])) } : "pass";
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
    return generic ? { plain_english: `Your home page shows up in Google as "${t}". That tells nobody what you do or where. A name like "Sacramento Plumber | ${ctx.business.name}" is what people click.`, evidence: [ev(`<title>${t}</title>`, home(site).finalUrl)] } : "pass";
  },
});

siteCheck({
  id: "meta_description_missing",
  problem: "Pages with no summary under your Google result",
  category: C,
  title: "Every page has a meta description",
  description: "The description is the grey text under the blue link. It does not affect ranking but decides whether people click.",
  severity: "medium",
  impact: 45,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).filter((p) => !p.metaDescription);
    return bad.length ? { plain_english: `${bad.length} of ${count(keyPages(site).length, "page")} ${v(keyPages(site).length, "have")} no short summary for Google to show under your name: ${listUrls(bad)}. Google picks random text from the page instead.`, evidence: bad.slice(0, 5).map((p) => ev("no <meta name=description>", p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "meta_description_length",
  problem: "Google summaries are the wrong length",
  category: C,
  title: "Meta descriptions are the right length",
  description: "Over ~160 characters gets truncated; under ~70 looks thin next to competitors.",
  severity: "low",
  impact: 20,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).filter((p) => p.metaDescription && (p.metaDescription.length > 170 || p.metaDescription.length < 60));
    return bad.length ? { plain_english: `${bad.length} of the summaries shown under your Google results are too long or too short: ${listUrls(bad)}. They get cut off or say too little to earn a click.`, evidence: bad.slice(0, 5).map((p) => ev(`${p.metaDescription!.length} chars`, p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "meta_description_duplicate",
  problem: "Several pages share the same Google summary",
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
    return dupes.length ? { plain_english: `${dupes.length} page summaries are copied word for word across pages, so Google shows the same text for different pages.`, evidence: dupes.slice(0, 5).map((urls) => ev(urls.map(shortUrl).join(", "), urls[0])) } : "pass";
  },
});

siteCheck({
  id: "h1_missing",
  problem: "Pages with no main headline",
  category: C,
  title: "Every page has one H1",
  description: "The H1 is the page's headline for search engines and screen readers.",
  severity: "medium",
  impact: 50,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).filter((p) => p.h1s.length === 0);
    return bad.length ? { plain_english: `${count(bad.length, "page")} ${v(bad.length, "have")} no main headline: ${listUrls(bad)}. Google and visitors use it to understand what the page is about.`, evidence: bad.slice(0, 5).map((p) => ev("no <h1>", p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "h1_multiple",
  problem: "Pages with several main headlines",
  category: C,
  title: "Pages do not have several H1s",
  description: "Several H1s dilute the page's topic; theme builders do this by accident.",
  severity: "low",
  impact: 25,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).filter((p) => p.h1s.length > 1);
    return bad.length ? { plain_english: `${count(bad.length, "page")} ${v(bad.length, "have")} several main headlines: ${listUrls(bad)}. Google cannot tell which one describes the page.`, evidence: bad.slice(0, 5).map((p) => ev(p.h1s.map((h) => `"${h}"`).join(" / "), p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "heading_order",
  problem: "Headings are out of order",
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
    return bad.length ? { plain_english: `${count(bad.length, "page")} ${v(bad.length, "have")} headings out of order, a main headline jumping straight to a small sub-heading: ${listUrls(bad)}. Screen readers and Google read the page as jumbled.`, evidence: bad.slice(0, 5).map((p) => ev(p.headings.map((h) => `h${h.level}`).join(" → "), p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "canonical_missing",
  problem: "Pages do not name their official web address",
  category: C,
  title: "Pages declare a canonical URL",
  description: "Without a canonical tag, www/non-www and query-string variants split ranking signals.",
  severity: "low",
  impact: 30,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).filter((p) => !p.canonical);
    return bad.length === keyPages(site).length ? { plain_english: "Your pages do not tell Google which web address is the official one. When the same page can be reached at several addresses, Google splits its credit between them.", evidence: bad.slice(0, 3).map((p) => ev("no rel=canonical", p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "canonical_cross_host",
  problem: "Pages credit another website as the original",
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
    return bad.length ? { plain_english: `${count(bad.length, "page")} ${v(bad.length, "tell")} Google that the official copy lives on a different website: ${listUrls(bad)}. Google may credit that other site instead of yours.`, evidence: bad.slice(0, 5).map((p) => ev(`canonical → ${p.canonical}`, p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "noindex_key_page",
  problem: "Important pages are hidden from Google",
  category: C,
  title: "Important pages are indexable",
  description: "A 'noindex' left on a service or contact page removes it from Google entirely.",
  severity: "critical",
  impact: 85,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).filter((p) => p.robotsMeta && /noindex/.test(p.robotsMeta));
    return bad.length ? { plain_english: `${count(bad.length, "page")} ${v(bad.length, "are")} marked "do not show in Google": ${listUrls(bad)}. Unless that is deliberate, those pages are invisible to searchers.`, evidence: bad.slice(0, 5).map((p) => ev(`<meta name=robots content="${p.robotsMeta}">`, p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "robots_txt_missing",
  problem: "No rules file for search engines",
  category: C,
  title: "robots.txt exists",
  description: "Not fatal, but a missing robots.txt means no sitemap pointer and no control over crawlers.",
  severity: "low",
  impact: 15,
  fix: "easy",
  run: (site) => (site.robots.status === "unavailable" ? { unavailable: "robots.txt could not be fetched" } : site.robots.status === "missing" ? { plain_english: "Your site has no rules file for search engines. Google still reads the site, but it has no pointer to your list of pages and no guidance on what matters.", evidence: [ev("GET /robots.txt did not return a robots file", `${new URL(site.canonicalUrl).origin}/robots.txt`)] } : "pass"),
});

siteCheck({
  id: "robots_txt_blocks_all",
  problem: "Your site tells search engines to stay out",
  category: C,
  title: "robots.txt does not block search engines",
  description: "A 'Disallow: /' for everyone keeps Google out of the whole site. It happens after a redesign more often than you would think.",
  severity: "critical",
  impact: 100,
  fix: "easy",
  run: (site) => (site.robots.status !== "ok" ? { unavailable: "no robots.txt to evaluate" } : site.robots.blocksAll ? { plain_english: "Your site tells every search engine to stay out. Nothing on it can appear in Google until that is changed.", evidence: [ev(site.robots.text!.slice(0, 300), `${new URL(site.canonicalUrl).origin}/robots.txt`)] } : "pass"),
});

siteCheck({
  id: "sitemap_missing",
  problem: "No list of pages for Google",
  category: C,
  title: "An XML sitemap exists",
  description: "The sitemap tells Google every page you want indexed, including new service pages.",
  severity: "medium",
  impact: 40,
  fix: "easy",
  run: (site) => (site.sitemap.status === "unavailable" ? { unavailable: "sitemap could not be fetched" } : site.sitemap.status === "missing" || site.sitemap.status === "invalid" ? { plain_english: site.sitemap.status === "invalid" ? `Your list of pages for Google (${shortUrl(site.sitemap.url!)}) is broken and cannot be read.` : "Your site has no list of pages for Google to read, so new or deeper pages can take weeks to be found.", evidence: [ev(`sitemap status: ${site.sitemap.status}`, site.sitemap.url ?? `${new URL(site.canonicalUrl).origin}/sitemap.xml`)] } : "pass"),
});

siteCheck({
  id: "sitemap_not_in_robots",
  problem: "Search engines are not pointed to your page list",
  category: C,
  title: "robots.txt points at the sitemap",
  description: "The Sitemap: line is how crawlers other than Google find your sitemap.",
  severity: "low",
  impact: 15,
  fix: "easy",
  run: (site) => (site.robots.status !== "ok" || site.sitemap.status !== "ok" ? { unavailable: "needs both robots.txt and a sitemap" } : site.robots.sitemaps.length ? "pass" : { plain_english: "Your site has a list of pages for Google but never points search engines to it, so they may not find it.", evidence: [ev(site.robots.text!.slice(0, 200), `${new URL(site.canonicalUrl).origin}/robots.txt`)] }),
});

siteCheck({
  id: "sitemap_broken_urls",
  problem: "Your page list sends Google to dead pages",
  category: C,
  title: "Sitemap URLs resolve",
  description: "Dead URLs in the sitemap waste crawl budget and signal neglect.",
  severity: "medium",
  impact: 35,
  fix: "easy",
  run: (site) => (site.sitemap.status !== "ok" ? { unavailable: "no sitemap" } : site.sitemap.brokenSample.length ? { plain_english: `${site.sitemap.brokenSample.length} of the pages you list for Google no longer exist. Google wastes visits on them and trusts the list less.`, evidence: site.sitemap.brokenSample.map((b) => ev(`HTTP ${b.status}`, b.url)) } : "pass"),
});

siteCheck({
  id: "broken_internal_links",
  problem: "Links on your site lead to dead pages",
  category: C,
  title: "Internal links work",
  description: "Links to missing pages lose visitors and leak ranking signals.",
  severity: "medium",
  impact: 50,
  fix: "easy",
  run: (site) => {
    const bad = site.linkProbes.filter((l) => l.status >= 400 && l.foundOn.length > 0);
    return bad.length ? { plain_english: `${count(bad.length, "link")} on your site lead to pages that do not exist. Visitors hit a dead end and Google marks the site as unmaintained.`, evidence: bad.slice(0, 8).map((l) => ev(`HTTP ${l.status} for ${shortUrl(l.url)} (linked from ${l.foundOn.slice(0, 2).map(shortUrl).join(", ")})`, l.url)) } : "pass";
  },
});

siteCheck({
  id: "redirect_chains",
  problem: "Links bounce through forwarding addresses",
  category: C,
  title: "Internal links do not hop through redirects",
  description: "Each redirect hop slows the page and loses a little ranking signal; chains of two or more are pure waste.",
  severity: "low",
  impact: 25,
  fix: "easy",
  run: (site) => {
    const chains = site.linkProbes.filter((l) => l.redirectChain.length >= 3);
    const singles = site.linkProbes.filter((l) => l.redirectChain.length === 2 && l.foundOn.length);
    if (chains.length) return { plain_english: `${count(chains.length, "link")} on your site bounce through two or more forwarding addresses before landing. Each bounce adds waiting time and loses Google credit.`, evidence: chains.slice(0, 5).map((l) => ev(l.redirectChain.map(shortUrl).join(" → "), l.url)) };
    if (singles.length >= 3) return { plain_english: `${singles.length} links on your site point at old addresses that forward somewhere else. Each one adds a delay.`, evidence: singles.slice(0, 5).map((l) => ev(l.redirectChain.map(shortUrl).join(" → "), l.url)), severity: "low", impact_score: 15 };
    return "pass";
  },
});

siteCheck({
  id: "soft_404",
  problem: "Missing pages pretend to exist",
  category: C,
  title: "Missing pages return a real 404",
  description: "A site that answers 200 for pages that do not exist confuses Google about which URLs are real.",
  severity: "medium",
  impact: 35,
  fix: "medium",
  run: (site) => (site.softNotFound.isSoft404 === null ? { unavailable: "could not probe a missing URL" } : site.softNotFound.isSoft404 ? { plain_english: "When someone opens a page that does not exist, your site shows a normal page instead of saying \"not found\". Google may treat your real pages as copies of it.", evidence: [ev(`GET ${site.softNotFound.probedPath} → ${site.softNotFound.status}`, `${new URL(site.canonicalUrl).origin}${site.softNotFound.probedPath}`)] } : "pass"),
});

siteCheck({
  id: "viewport_missing",
  problem: "Pages not set up for phones",
  category: C,
  title: "Pages are mobile-ready (viewport)",
  description: "Without a viewport meta tag, phones render the desktop layout shrunk down.",
  severity: "high",
  impact: 70,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).filter((p) => !p.viewport);
    return bad.length ? { plain_english: `${count(bad.length, "page")} ${v(bad.length, "are")} not set up for phones, so they appear tiny and need pinching to read: ${listUrls(bad)}.`, evidence: bad.slice(0, 5).map((p) => ev("no <meta name=viewport>", p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "lang_missing",
  problem: "Pages do not state their language",
  category: C,
  title: "Pages declare their language",
  description: "<html lang> helps screen readers and search engines; it is a one-line fix.",
  severity: "low",
  impact: 10,
  fix: "easy",
  run: (site) => (home(site).lang ? "pass" : { plain_english: "Your pages do not say what language they are written in. Google and screen readers have to guess.", evidence: [ev('<html> without lang="en"', home(site).finalUrl)] }),
});

siteCheck({
  id: "favicon_missing",
  problem: "No site icon",
  category: C,
  title: "Site has a favicon",
  description: "Google shows the favicon in mobile results; a missing one looks unfinished.",
  severity: "low",
  impact: 15,
  fix: "easy",
  run: (site) => (home(site).hasFavicon ? "pass" : { plain_english: "Your site has no small icon, so Google results and browser tabs show a blank square next to your name.", evidence: [ev("no <link rel=icon>", home(site).finalUrl)] }),
});

siteCheck({
  id: "html_oversized",
  problem: "Oversized pages",
  category: C,
  title: "Pages are not bloated",
  description: "HTML over ~500 KB usually means inlined page-builder CSS and slows every visit.",
  severity: "low",
  impact: 25,
  fix: "medium",
  run: (site) => {
    const bad = site.pages.filter((p) => p.htmlBytes > 500_000);
    return bad.length ? { plain_english: `${count(bad.length, "page")} ${v(bad.length, "are")} far larger than they need to be: ${listUrls(bad)}. They load slowly, especially on phones.`, evidence: bad.slice(0, 5).map((p) => ev(`${Math.round(p.htmlBytes / 1024)} KB of HTML`, p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "script_bloat",
  problem: "Too many add-on files slow the page",
  category: C,
  title: "Pages do not load excessive scripts",
  description: "Dozens of third-party scripts are the usual cause of a slow, janky mobile site.",
  severity: "low",
  impact: 30,
  fix: "medium",
  run: (site) => {
    const h = home(site);
    return h.scripts.external > 25 ? { plain_english: `Your home page loads ${h.scripts.external} separate add-on files before it becomes usable. Every one of them delays the page.`, evidence: [ev(`${h.scripts.external} external <script src> tags, ${Math.round(h.scripts.inlineBytes / 1024)} KB inline`, h.finalUrl)] } : "pass";
  },
});

siteCheck({
  id: "blocked_pages",
  problem: "Your site blocks automated visitors like Google",
  category: C,
  title: "The site allows automated visitors",
  description: "If our crawler is walled off, so are some search and AI crawlers. We do not bypass bot protection.",
  severity: "medium",
  impact: 40,
  fix: "medium",
  run: (site) => {
    const blocked = site.failures.filter((f) => f.reason === "blocked");
    return blocked.length ? { plain_english: `${count(blocked.length, "page")} refused to open for our automated visit (a bot wall or a block rule). Google and AI assistants get the same treatment, so those pages may be missing from search.`, evidence: blocked.slice(0, 5).map((f) => ev(f.message, f.url)) } : "pass";
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
    return errs.length ? { plain_english: `${count(errs.length, "page")} failed to load or timed out. If it happened to us, it happens to visitors and to Google.`, evidence: errs.slice(0, 5).map((f) => ev(`${f.reason}: ${f.message}`, f.url)) } : "pass";
  },
});

// ---- PageSpeed-backed --------------------------------------------------------

siteCheck({
  id: "psi_performance_mobile",
  problem: "Slow on phones",
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
      plain_english: `Google scores your home page ${m.performanceScore} out of 100 for speed on phones (${poor ? "poor" : "needs improvement"}). Slow pages lose visitors before they see your number.${m.opportunities.length ? ` The biggest causes: ${m.opportunities.slice(0, 3).map((o) => describeOpportunity(o.id)).join(", ")}.` : ""}`,
      evidence: [ev(`performance ${m.performanceScore}/100; LCP ${m.lab.lcpMs ?? "?"} ms; TBT ${m.lab.tbtMs ?? "?"} ms; ${m.opportunities.map((o) => `${o.id}${o.displayValue ? ` (${o.displayValue})` : ""}`).join("; ")}`, home(site).finalUrl, "api_field")],
      severity: poor ? "high" : "medium",
      impact_score: poor ? 70 : 45,
    };
  },
});

siteCheck({
  id: "psi_lcp",
  problem: "Main content takes too long to appear on phones",
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
    return { plain_english: `On phones, the main part of your home page takes ${(lcp / 1000).toFixed(1)} seconds to appear (${m?.field.lcpMs ? "measured on real visitors" : "measured in a test"}). Google wants under 2.5 seconds, and visitors start leaving after 3.`, evidence: [ev(`LCP ${lcp} ms (${m?.field.lcpMs ? "CrUX field" : "Lighthouse lab"})`, home(site).finalUrl, "api_field")], severity: poor ? "high" : "medium", impact_score: poor ? 65 : 40 };
  },
});

siteCheck({
  id: "psi_inp",
  problem: "Site reacts slowly to taps",
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
    return { plain_english: `When real visitors tap something on your site, it takes ${inp} milliseconds to react. Google wants under 200. It feels broken, so people tap again or leave.`, evidence: [ev(`INP p75 ${inp} ms (CrUX)`, home(site).finalUrl, "api_field")], severity: inp > 500 ? "high" : "medium" };
  },
});

siteCheck({
  id: "psi_cls",
  problem: "Page jumps around while loading",
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
    return { plain_english: `Your page jumps around while it loads, so visitors tap the wrong thing. Google measures the jump at ${cls.toFixed(2)}; anything over 0.10 counts against you.`, evidence: [ev(`CLS ${cls.toFixed(3)}`, home(site).finalUrl, "api_field")], severity: cls > 0.25 ? "medium" : "low" };
  },
});

siteCheck({
  id: "psi_ttfb",
  problem: "Slow web server",
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
    return { plain_english: `Your web server takes ${ttfb} milliseconds just to start replying. Google wants under 800. Everything else on the page waits behind this.`, evidence: [ev(`TTFB ${ttfb} ms`, home(site).finalUrl, "api_field")] };
  },
});

siteCheck({
  id: "psi_desktop_gap",
  problem: "Slow even on a computer",
  category: C,
  title: "Desktop performance is acceptable",
  description: "Desktop is more forgiving; a low desktop score points at server or asset problems, not just phones.",
  severity: "low",
  impact: 25,
  fix: "medium",
  run: (site, ctx) => {
    const d = ctx.pagespeed?.desktop;
    if (!d || d.performanceScore === null) return { unavailable: "PageSpeed desktop result not available" };
    return d.performanceScore < 70 ? { plain_english: `Even on a computer, Google scores your home page ${d.performanceScore} out of 100 for speed. The problem is the site itself, not just phones.`, evidence: [ev(`desktop performance ${d.performanceScore}/100`, home(site).finalUrl, "api_field")] } : "pass";
  },
});

siteCheck({
  id: "js_dependent_content",
  problem: "Page is nearly empty until scripts run",
  category: C,
  title: "Content is present without JavaScript",
  description: "If the HTML has almost no text and a pile of scripts, crawlers that do not run JavaScript (most AI crawlers) see an empty page.",
  severity: "medium",
  impact: 45,
  fix: "hard",
  run: (site) => {
    const h = home(site);
    return h.wordCount < 60 && h.scripts.external >= 3 ? { plain_english: `Your home page has only ${h.wordCount} words of real text; the rest is built by scripts after loading. Google usually copes, but AI assistants and some search engines see an almost empty page.`, evidence: [ev(`${h.wordCount} words in static HTML; ${h.scripts.external} external scripts`, h.finalUrl)] } : "pass";
  },
});
