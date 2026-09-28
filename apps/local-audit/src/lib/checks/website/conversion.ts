import { ev, home, keyPages, listUrls, pagesOfKind, siteCheck } from "./util";

const C = "conversion" as const;

siteCheck({
  id: "phone_above_fold",
  problem: "Phone number is not visible before scrolling",
  category: C,
  title: "Phone number visible before scrolling",
  description: "On a phone, the number should be in the header or hero. If it is only in the footer, most callers never see it.",
  severity: "high",
  impact: 70,
  fix: "easy",
  run: (site) => {
    const h = home(site);
    const top = `${h.headerText} ${h.textStart}`;
    const visible = /\(?\b[2-9]\d{2}\)?[\s.-]?[2-9]\d{2}[\s.-]?\d{4}\b/.test(top) || h.links.some((l) => l.region === "header" && /call/i.test(l.text));
    return visible ? "pass" : { plain_english: "No phone number appears in the header or the first screen of the home page.", evidence: [ev(`header: "${h.headerText.slice(0, 120)}" · first text: "${h.textStart.slice(0, 120)}"`, h.finalUrl)] };
  },
});

siteCheck({
  id: "cta_above_fold",
  problem: "No call to action before scrolling",
  category: C,
  title: "A clear call to action before scrolling",
  description: "'Call now', 'Get a free quote' or 'Book online' in the header or hero. Visitors who have to hunt for the next step leave.",
  severity: "high",
  impact: 65,
  fix: "easy",
  run: (site) => {
    const h = home(site);
    return h.ctaAboveFold.length ? "pass" : { plain_english: "The header and hero have no call-to-action wording (call, quote, book, schedule, contact).", evidence: [ev(`header: "${h.headerText.slice(0, 160)}"`, h.finalUrl)] };
  },
});

siteCheck({
  id: "quote_path_missing",
  problem: "No way to request a quote or book online",
  category: C,
  title: "Visitors can request a quote or book online",
  description: "Half of local-service visitors will not call. Without a form or booking widget they go to the competitor who has one.",
  severity: "high",
  impact: 70,
  fix: "medium",
  run: (site) => {
    const forms = site.pages.filter((p) => p.forms.some((f) => f.fields >= 2));
    const booking = site.pages.some((p) => p.widgets.booking.length);
    return forms.length || booking ? "pass" : { plain_english: "No quote form or booking widget was found on any crawled page. Add a short form (name, phone, what you need) on the home and service pages, or embed the booking tool you already use.", evidence: [ev(`${site.pages.length} pages crawled; forms with 2+ fields: 0; booking widgets: none`, home(site).finalUrl)] };
  },
});

siteCheck({
  id: "form_too_long",
  problem: "Lead form asks for too many fields",
  category: C,
  title: "Forms are short",
  description: "Every extra field costs completions. A lead form needs name, phone and the problem; the rest can wait for the call.",
  severity: "medium",
  impact: 45,
  fix: "easy",
  run: (site) => {
    const long = site.pages.flatMap((p) => p.forms.filter((f) => f.fields > 6).map((f) => ({ p, f })));
    return long.length ? { plain_english: `${long.length} form(s) ask for ${long[0]!.f.fields}+ fields. Cut to name, phone and a message.`, evidence: long.slice(0, 3).map(({ p, f }) => ev(`${f.fields} fields (${f.method.toUpperCase()} ${f.action ?? ""})`, p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "form_no_phone_field",
  problem: "Lead form has no phone field",
  category: C,
  title: "Lead forms ask for a phone number",
  description: "A form that only collects email produces leads nobody can call back quickly.",
  severity: "low",
  impact: 25,
  fix: "easy",
  run: (site) => {
    const forms = site.pages.flatMap((p) => p.forms.filter((f) => f.fields >= 2 && f.hasTextarea).map((f) => ({ p, f })));
    if (!forms.length) return { unavailable: "no lead form found" };
    const noPhone = forms.filter(({ f }) => !f.hasPhoneField);
    return noPhone.length === forms.length ? { plain_english: "The lead form has no phone field, so every lead starts with an email back-and-forth.", evidence: noPhone.slice(0, 2).map(({ p, f }) => ev(`${f.fields} fields, no tel input`, p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "contact_page_missing",
  problem: "No contact page",
  category: C,
  title: "A contact page exists",
  description: "Visitors and Google both expect /contact with the address, phone, hours, map and a form.",
  severity: "medium",
  impact: 45,
  fix: "easy",
  run: (site) => (pagesOfKind(site, "contact").length ? "pass" : { plain_english: "No contact page was found.", evidence: [ev(`page kinds crawled: ${[...new Set(Object.values(site.kinds))].join(", ")}`, home(site).finalUrl)] }),
});

siteCheck({
  id: "social_proof_missing",
  problem: "No reviews or testimonials on the home page",
  category: C,
  title: "Reviews or testimonials are shown",
  description: "A rating with a review count, or three named quotes, is the single strongest conversion element on a local site.",
  severity: "high",
  impact: 60,
  fix: "easy",
  run: (site) => {
    const h = home(site);
    const proof = /\b(review|testimonial|rated|stars?|★|⭐|out of 5|\d\.\d\s*\/\s*5|customers? say|what (our )?(clients|customers) say)\b/i.test(h.text) || h.widgets.reviews.length > 0 || pagesOfKind(site, "reviews").length > 0;
    return proof ? "pass" : { plain_english: "The home page shows no reviews, rating or testimonials. Put the Google rating and review count near the top, and three real quotes with names.", evidence: [ev("no review/testimonial wording or widget on the home page", h.finalUrl)] };
  },
});

siteCheck({
  id: "trust_badges_missing",
  problem: "No licence, insurance or guarantee stated near the call to action",
  category: C,
  title: "Trust signals near the call to action",
  description: "'Licensed and insured', a guarantee, years in business, BBB: visitors look for these before they call.",
  severity: "medium",
  impact: 40,
  fix: "easy",
  run: (site) => {
    const h = home(site);
    return h.trustPhrases.length ? "pass" : { plain_english: "The home page states no licence, insurance, guarantee or years in business.", evidence: [ev(`trust phrases on home: none (site-wide: ${[...new Set(site.pages.flatMap((p) => p.trustPhrases))].join(", ") || "none"})`, h.finalUrl)] };
  },
});

siteCheck({
  id: "pricing_transparency",
  problem: "No pricing guidance anywhere on the site",
  category: C,
  title: "Some pricing guidance is given",
  description: "'From $89', 'flat-rate', 'free estimates': visitors who cannot gauge cost do not call. Even a range beats silence.",
  severity: "medium",
  impact: 40,
  fix: "easy",
  run: (site) => {
    const pages = keyPages(site);
    const mentions = pages.reduce((n, p) => n + p.pricingMentions, 0);
    return mentions > 0 ? "pass" : { plain_english: "No prices, price ranges or 'free estimate' wording anywhere on the crawled pages.", evidence: [ev(`0 pricing mentions across ${pages.length} pages`, home(site).finalUrl)] };
  },
});

siteCheck({
  id: "chat_widget_missing",
  problem: "No one-tap way to reach you on mobile",
  category: C,
  title: "An instant way to reach you on mobile",
  description: "A tap-to-call link, a booking widget or a chat/text option: visitors on a phone want one tap, not a form. Only flagged when none of the three exists.",
  severity: "low",
  impact: 20,
  fix: "easy",
  run: (site) => {
    const h = home(site);
    const instant = h.telLinks.length > 0 || site.pages.some((p) => p.widgets.chat.length || p.widgets.booking.length);
    return instant ? "pass" : { plain_english: "The home page has no tap-to-call link, booking widget or chat/text option. On a phone every contact needs typing.", evidence: [ev("no tel: link, booking or chat widget detected on the home page", h.finalUrl)] };
  },
});

siteCheck({
  id: "mobile_tap_targets",
  problem: "Buttons and links are too small or too close on phones",
  category: C,
  title: "Buttons and links are tappable on phones",
  description: "PageSpeed's tap-target audit: links too small or too close together cause mis-taps.",
  severity: "medium",
  impact: 35,
  fix: "easy",
  run: (site, ctx) => {
    const s = ctx.pagespeed?.mobile?.usability.tapTargets;
    if (s === null || s === undefined) return { unavailable: "no tap-target audit in PageSpeed result" };
    return s < 0.9 ? { plain_english: "Lighthouse flags tap targets that are too small or too close together on mobile.", evidence: [ev(`tap-targets audit score ${s}`, home(site).finalUrl, "api_field")] } : "pass";
  },
});

siteCheck({
  id: "mobile_font_size",
  problem: "Text too small to read on phones without zooming",
  category: C,
  title: "Text is readable without zooming",
  description: "PageSpeed's font-size audit: text under 12px on mobile forces pinch-zoom.",
  severity: "medium",
  impact: 35,
  fix: "easy",
  run: (site, ctx) => {
    const s = ctx.pagespeed?.mobile?.usability.fontSize;
    if (s === null || s === undefined) return { unavailable: "no font-size audit in PageSpeed result" };
    return s < 1 ? { plain_english: "Lighthouse reports text that is too small to read on mobile without zooming.", evidence: [ev(`font-size audit score ${s}`, home(site).finalUrl, "api_field")] } : "pass";
  },
});

siteCheck({
  id: "mobile_horizontal_scroll",
  problem: "Page scrolls sideways on phones",
  category: C,
  title: "Content fits the phone screen",
  description: "PageSpeed's content-width audit: a page wider than the viewport scrolls sideways and hides the call button.",
  severity: "high",
  impact: 55,
  fix: "medium",
  run: (site, ctx) => {
    const s = ctx.pagespeed?.mobile?.usability.contentWidth;
    if (s === null || s === undefined) return { unavailable: "no content-width audit in PageSpeed result" };
    return s < 1 ? { plain_english: "The page is wider than a phone screen, so it scrolls sideways.", evidence: [ev(`content-width audit score ${s}`, home(site).finalUrl, "api_field")] } : "pass";
  },
});

siteCheck({
  id: "slow_mobile_bounce",
  problem: "Mobile load time is driving visitors away",
  category: C,
  title: "Mobile load time is not driving visitors away",
  description: "Google's own data: as load time goes from 1 s to 5 s, the chance of a bounce rises 90%. This is the conversion side of the speed numbers.",
  severity: "high",
  impact: 60,
  fix: "medium",
  run: (site, ctx) => {
    const m = ctx.pagespeed?.mobile;
    const lcp = m?.field.lcpMs ?? m?.lab.lcpMs ?? null;
    if (lcp === null) return { unavailable: "no PageSpeed mobile data" };
    return lcp > 4_000 ? { plain_english: `The mobile home page takes ${(lcp / 1000).toFixed(1)} s to show its main content. A meaningful share of ad and search visitors leave before that; every one of them was paid for or earned.`, evidence: [ev(`mobile LCP ${lcp} ms; performance ${m?.performanceScore ?? "?"}/100`, home(site).finalUrl, "api_field")] } : "pass";
  },
});

siteCheck({
  id: "no_analytics",
  problem: "No analytics or call tracking installed",
  category: C,
  title: "Calls and form fills are measurable",
  description: "Without analytics or call tracking nobody knows which page produces leads. Informational, but it blocks every optimisation after this audit.",
  severity: "low",
  impact: 20,
  fix: "easy",
  run: (site) => (home(site).widgets.analytics.length ? "pass" : { plain_english: "No analytics or call-tracking script was detected on the home page.", evidence: [ev("no GA4/GTM/Meta/Clarity/CallRail scripts detected", home(site).finalUrl)] }),
});

siteCheck({
  id: "key_pages_thin_cta",
  problem: "Service pages have no next step",
  category: C,
  title: "Service pages end with a next step",
  description: "Each service page should carry its own call-to-action; visitors rarely go back to the home page to find it.",
  severity: "medium",
  impact: 40,
  fix: "easy",
  run: (site) => {
    const services = pagesOfKind(site, "service");
    if (!services.length) return { unavailable: "no service pages found" };
    const bare = services.filter((p) => !p.telLinks.length && !p.forms.length && !p.links.some((l) => l.internal && /contact|quote|book|schedule/i.test(`${l.text} ${l.href}`) && l.region !== "nav" && l.region !== "footer"));
    return bare.length ? { plain_english: `${bare.length} of ${services.length} service page(s) have no call link, form or quote button in the body: ${listUrls(bare)}.`, evidence: bare.slice(0, 4).map((p) => ev("no tel: link, form or contact/quote link outside nav/footer", p.finalUrl)) } : "pass";
  },
});
