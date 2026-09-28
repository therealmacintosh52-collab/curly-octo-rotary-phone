import { count, ev, home, keyPages, listUrls, pagesOfKind, serviceTokens, shortUrl, siteCheck, v } from "./util";

const C = "content_keywords" as const;

siteCheck({
  id: "thin_pages",
  problem: "Pages too thin to rank",
  category: C,
  title: "Pages have enough content to rank",
  description: "Pages under ~300 words rarely rank for anything; service pages need 500+ words of specific, useful text.",
  severity: "medium",
  impact: 50,
  fix: "medium",
  run: (site) => {
    const thin = keyPages(site).filter((p) => p.wordCount < 300 && ["service", "location", "about", "home", "other"].includes(site.kinds[p.finalUrl] ?? "other"));
    return thin.length ? { plain_english: `${count(thin.length, "page")} ${v(thin.length, "have")} fewer than 300 words: ${listUrls(thin)}. Pages with this little on them rarely appear in Google and rarely convince anyone.`, evidence: thin.slice(0, 6).map((p) => ev(`${p.wordCount} words`, p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "home_word_count",
  problem: "Home page barely explains the business",
  category: C,
  title: "Home page explains the business",
  description: "A home page with a few slogans and no substance gives Google nothing to rank and visitors nothing to trust.",
  severity: "medium",
  impact: 45,
  fix: "medium",
  run: (site) => {
    const h = home(site);
    return h.wordCount < 200 ? { plain_english: `Your home page has only ${h.wordCount} words. It does not give Google enough to rank you or visitors enough to trust you.`, evidence: [ev(`${h.wordCount} words`, h.finalUrl)] } : "pass";
  },
});

siteCheck({
  id: "primary_service_in_title",
  problem: "Home page name does not say what you do",
  category: C,
  title: "Home title names the main service",
  description: "The word people type ('plumber', 'dentist', 'window tinting') has to be in the home page title.",
  severity: "high",
  impact: 60,
  fix: "easy",
  run: (site, ctx) => {
    const services = serviceTokens(ctx);
    if (!services.length) return { unavailable: "no services listed for this business" };
    const t = (home(site).title ?? "").toLowerCase();
    const hit = services.find((s) => t.includes(s) || s.split(" ").every((w) => w.length > 3 && t.includes(w)));
    return hit ? "pass" : { plain_english: `Your home page name in Google ("${home(site).title}") does not contain any of your main services (${services.join(", ")}), the words people actually type.`, evidence: [ev(`<title>${home(site).title}</title>`, home(site).finalUrl)] };
  },
});

siteCheck({
  id: "copyright_outdated",
  problem: "Footer copyright year is out of date",
  category: C,
  title: "Footer year is current",
  description: "'© 2021' tells visitors and raters the site is unmaintained.",
  severity: "low",
  impact: 20,
  fix: "easy",
  run: (site) => {
    const y = home(site).copyrightYear;
    if (!y) return { unavailable: "no copyright year found" };
    const now = new Date().getFullYear();
    return y < now - 1 ? { plain_english: `Your footer says © ${y}. It is ${now}. It tells visitors the site may be abandoned.`, evidence: [ev(`copyright year ${y}`, home(site).finalUrl)] } : "pass";
  },
});

siteCheck({
  id: "stale_content",
  problem: "Newest dated content is years old",
  category: C,
  title: "Dated content is recent",
  description: "Blog posts and news last touched years ago signal an abandoned site.",
  severity: "low",
  impact: 20,
  fix: "medium",
  run: (site) => {
    const dated = site.pages.flatMap((p) => p.datesFound.map((d) => ({ p, d, year: Number((d.match(/(20\d{2})/) ?? [])[1]) })).filter((x) => x.year));
    if (!dated.length) return { unavailable: "no dates found on pages" };
    const newest = Math.max(...dated.map((x) => x.year));
    const now = new Date().getFullYear();
    return newest < now - 1 ? { plain_english: `The newest date anywhere on your site is ${newest}. Visitors and Google read that as a business that may no longer be active.`, evidence: dated.filter((x) => x.year === newest).slice(0, 3).map((x) => ev(x.d, x.p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "duplicate_content",
  problem: "Pages are near-duplicates of each other",
  category: C,
  title: "Pages are not near-duplicates",
  description: "Location or service pages that only swap a city name are treated as one page and rank as none.",
  severity: "medium",
  impact: 40,
  fix: "medium",
  run: (site) => {
    const pages = keyPages(site).filter((p) => p.wordCount >= 80);
    const shingles = (t: string) => {
      const w = t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
      const s = new Set<string>();
      for (let i = 0; i + 4 < w.length; i += 2) s.add(w.slice(i, i + 5).join(" "));
      return s;
    };
    const raw = pages.map((p) => ({ p, s: shingles(p.text) }));
    // Header, footer and nav text repeat on every page; shingles seen on half the pages or more are boilerplate, not duplication.
    const seenOn = new Map<string, number>();
    for (const { s } of raw) for (const x of s) seenOn.set(x, (seenOn.get(x) ?? 0) + 1);
    const boilerplateMin = Math.max(3, Math.ceil(raw.length / 2));
    const sets = raw.map(({ p, s }) => ({ p, s: new Set([...s].filter((x) => (seenOn.get(x) ?? 0) < boilerplateMin)) }));
    const dupes: [string, string, number][] = [];
    for (let i = 0; i < sets.length; i++) {
      for (let j = i + 1; j < sets.length; j++) {
        const a = sets[i]!.s;
        const b = sets[j]!.s;
        if (!a.size || !b.size) continue;
        let inter = 0;
        for (const x of a) if (b.has(x)) inter++;
        const jac = inter / (a.size + b.size - inter);
        if (jac > 0.6) dupes.push([sets[i]!.p.finalUrl, sets[j]!.p.finalUrl, Math.round(jac * 100)]);
      }
    }
    return dupes.length ? { plain_english: `${count(dupes.length, "pair")} of pages say almost the same thing. Google treats them as one page, so neither ranks.`, evidence: dupes.slice(0, 5).map(([a, b, j]) => ev(`${shortUrl(a)} ≈ ${shortUrl(b)} (${j}% shared)`, a)) } : "pass";
  },
});

siteCheck({
  id: "blog_missing",
  problem: "No helpful content beyond the sales pages",
  category: C,
  title: "The site publishes helpful content",
  description: "A handful of guides answering what customers search before they call is how a local site earns rankings beyond its own name.",
  severity: "low",
  impact: 25,
  fix: "hard",
  run: (site) => (pagesOfKind(site, "blog", "faq").length ? "pass" : { plain_english: "Your site has no guides, tips or questions-and-answers. Without them it can only show up for your own name, never for the questions customers ask before they call.", evidence: [ev(`page kinds crawled: ${[...new Set(Object.values(site.kinds))].join(", ")}`, home(site).finalUrl)] }),
});

siteCheck({
  id: "keyword_stuffed_title",
  problem: "Page names are lists of search terms",
  category: C,
  title: "Titles read like a sentence, not a keyword list",
  description: "Titles that repeat the service and city several times get rewritten by Google and put customers off.",
  severity: "low",
  impact: 20,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).filter((p) => {
      if (!p.title) return false;
      const words = p.title.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3);
      const counts = new Map<string, number>();
      for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
      return [...counts.values()].some((n) => n >= 3) || (p.title.split(/[|\-–]/).length >= 4 && p.title.length > 70);
    });
    return bad.length ? { plain_english: `${count(bad.length, "page name")} ${v(bad.length, "repeat")} the same words or chain several search terms together: ${listUrls(bad)}. Google rewrites them and customers find them off-putting.`, evidence: bad.slice(0, 4).map((p) => ev(`"${p.title}"`, p.finalUrl)) } : "pass";
  },
});
