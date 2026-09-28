/**
 * Two synthetic websites served by a fake fetch: a deliberately flawed one
 * ("demo") that should trip most checks, and a clean one ("good") that should
 * trip none. Used by tests and by /dev/preview/audit?scenario=crawl.
 * Everything here is invented; nothing describes a real business.
 */
export interface FakeSite {
  origin: string;
  routes: Record<string, { status?: number; body?: string; headers?: Record<string, string> }>;
  /** Anything not in routes answers with this (a soft 404 when status is 200). */
  fallback: { status: number; body: string };
}

const flawedLayout = (title: string, body: string, extraHead = "") => `<!doctype html><html><head>
<title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
${extraHead}
<script src="https://cdn.example/lib1.js"></script><script src="https://cdn.example/lib2.js"></script>
<script>window.dataLayer=[];</script>
</head><body>
<header><a href="/">Demo Plumbing</a> <nav><a href="/services">Services</a> <a href="/about">About</a> <a href="/contact">Contact</a> <a href="/blog/old-post">Blog</a> <a href="/old-page">Old page</a></nav></header>
${body}
<footer>Call us: 916-555-0100 &nbsp; © 2021 Demo Plumbing <a href="/broken">Broken</a></footer>
</body></html>`;

export const DEMO_SITE: FakeSite = {
  origin: "https://demo-plumbing.example",
  routes: {
    "/robots.txt": { body: "User-agent: *\nDisallow: /private/\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n" },
    "/sitemap.xml": {
      headers: { "content-type": "application/xml" },
      body: `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://demo-plumbing.example/</loc></url><url><loc>https://demo-plumbing.example/services</loc></url><url><loc>https://demo-plumbing.example/gone-forever</loc></url></urlset>`,
    },
    "/gone-forever": { status: 404, body: "gone" },
    "/broken": { status: 404, body: "nope" },
    "/old-page": { status: 301, headers: { location: "/older" }, body: "" },
    "/older": { status: 301, headers: { location: "/about" }, body: "" },
    "/hero.jpg": { headers: { "content-type": "image/jpeg", "content-length": "1850000" }, body: "" },
    "/IMG_2041.JPG": { headers: { "content-type": "image/jpeg", "content-length": "640000" }, body: "" },
    "/": {
      body: flawedLayout(
        "Home",
        `<h1>Welcome</h1><h1>Demo Plumbing</h1>
<img src="/hero.jpg"><img src="/IMG_2041.JPG" alt="image"><img src="http://demo-plumbing.example/badge.png" alt="badge">
<h3>Our team</h3>
<p>We do plumbing. We are the best plumbing in the area and we have been the best for years and years, ask anyone who knows plumbing about us and they will say we are the best there is.</p>
<p>Learn more on our services page.</p>`,
        `<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Demo Plumbing","aggregateRating":{"@type":"AggregateRating","ratingValue":"5","reviewCount":"3"}}</script>
<script type="application/ld+json">{ this is not json }</script>`,
      ),
    },
    "/services": {
      body: flawedLayout("Services", `<h1>Services</h1><ul><li><a href="/services/water-heaters">Water heaters</a></li><li><a href="/services/drain-cleaning">Drain cleaning</a></li></ul>`),
    },
    "/services/water-heaters": {
      body: flawedLayout(
        "Water Heater Repair and Installation Services in Sacramento by Demo Plumbing Experts Since Forever",
        `<h1>Water heaters</h1><p>Tankless, tank, gas and electric. We install and repair.</p>`,
      ),
    },
    "/services/drain-cleaning": {
      body: flawedLayout("Drain Cleaning Sacramento | Sacramento Drain Cleaning | Drain Cleaning Service Sacramento CA | Plumber", `<h1>Drain cleaning</h1><p>Hydro jetting and snaking. Fast.</p>`, `<meta name="robots" content="noindex">`),
    },
    "/about": {
      body: flawedLayout("About", `<h1>About</h1><p>Founded by a plumber. We serve the region with pride and care for every customer we meet along the way of our journey.</p>`),
    },
    "/contact": {
      body: flawedLayout(
        "Contact",
        `<h1>Contact</h1><p>1 Main St, Sacramento, CA 95814</p>
<form method="post" action="/submit"><input name="first"><input name="last"><input name="company"><input name="phone" type="tel"><input name="email" type="email"><input name="address"><input name="city"><select name="service"><option>Repair</option></select><textarea name="msg"></textarea><button>Send</button></form>`,
      ),
    },
    "/blog/old-post": {
      body: flawedLayout("Blog", `<h1>Winter plumbing tips</h1><p>Posted January 12, 2022.</p><p>Keep pipes warm in winter by letting a faucet drip during hard freezes and insulating exposed lines in the garage and crawl space areas of the home.</p>`),
    },
  },
  fallback: { status: 200, body: flawedLayout("Home", "<h1>Welcome</h1><p>Page not found, here is our home page instead.</p>") },
};

const goodLayout = (title: string, desc: string, body: string, extraHead = "") => `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><title>${title}</title><meta name="description" content="${desc}">
<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.svg"><link rel="canonical" href="https://good-plumbing.example${title === "Good Plumbing | Sacramento Plumber" ? "/" : ""}">
<meta property="og:title" content="${title}">
${extraHead}
</head><body>
<header><a href="/"><img src="/logo.webp" alt="Good Plumbing logo" width="120" height="40"></a>
<a href="tel:+19165550100">(916) 555-0100</a> <a href="/contact" class="button">Get a free quote</a>
<nav><a href="/services/water-heaters">Water heaters</a> <a href="/services/drain-cleaning">Drain cleaning</a> <a href="/service-areas">Service areas</a> <a href="/about">About</a> <a href="/reviews">Reviews</a> <a href="/faq">FAQ</a> <a href="/contact">Contact</a></nav></header>
<main>${body}</main>
<footer><address>Good Plumbing, 1 Main St, Sacramento, CA 95814</address> <a href="tel:+19165550100">(916) 555-0100</a> · Monday – Friday 7:00 AM – 6:00 PM · Licensed, bonded and insured · CA Lic #123456 · © 2026 Good Plumbing
<iframe src="https://www.google.com/maps/embed?pb=synthetic" title="map"></iframe></footer>
</body></html>`;

const LB = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Plumber","name":"Good Plumbing","url":"https://good-plumbing.example/","telephone":"+1-916-555-0100","image":"https://good-plumbing.example/logo.webp","priceRange":"$$","address":{"@type":"PostalAddress","streetAddress":"1 Main St","addressLocality":"Sacramento","addressRegion":"CA","postalCode":"95814"},"geo":{"@type":"GeoCoordinates","latitude":38.58,"longitude":-121.49},"openingHoursSpecification":[{"@type":"OpeningHoursSpecification","dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday"],"opens":"07:00","closes":"18:00"}],"areaServed":["Sacramento","Elk Grove"],"sameAs":["https://www.google.com/maps/place/?q=place_id:ChIJgood","https://www.yelp.com/biz/good-plumbing-sacramento","https://www.facebook.com/goodplumbing"]}</script>`;
const longText = (n: number, topic = "the service") => Array.from({ length: n }, (_, i) => `Paragraph ${i + 1} about ${topic} covers step ${(i * 7) % 11} of the ${topic} visit: what the plumber checks for ${topic}, what ${topic} costs in Sacramento, and how long ${topic} usually takes.`).join(" ");

export const GOOD_SITE: FakeSite = {
  origin: "https://good-plumbing.example",
  routes: {
    "/robots.txt": { body: "User-agent: *\nAllow: /\nSitemap: https://good-plumbing.example/sitemap.xml\n" },
    "/sitemap.xml": { headers: { "content-type": "application/xml" }, body: `<?xml version="1.0"?><urlset><url><loc>https://good-plumbing.example/</loc></url><url><loc>https://good-plumbing.example/services/water-heaters</loc></url><url><loc>https://good-plumbing.example/contact</loc></url></urlset>` },
    "/llms.txt": { body: "# Good Plumbing\n> Licensed plumber in Sacramento, CA.\n" },
    "/logo.webp": { headers: { "content-type": "image/webp", "content-length": "12000" }, body: "" },
    "/team-sacramento-plumbers.webp": { headers: { "content-type": "image/webp", "content-length": "88000" }, body: "" },
    "/": {
      body: goodLayout(
        "Good Plumbing | Sacramento Plumber",
        "Licensed Sacramento plumber for water heaters, drain cleaning and repairs. Same-day service, upfront pricing, 4.9 stars from 210 Google reviews.",
        `<h1>Sacramento plumber for water heaters, drains and repairs</h1>
<p>Good Plumbing is a licensed, family-owned plumbing company in Sacramento, CA. We repair and install water heaters, clear drains and fix leaks across Sacramento and Elk Grove, usually the same day.</p>
<img src="/team-sacramento-plumbers.webp" alt="The Good Plumbing team in front of the Sacramento shop" width="1200" height="800" loading="lazy">
<img src="/water-heater-install-sacramento.webp" alt="Tankless water heater installed in a Sacramento garage" width="1200" height="800" loading="lazy">
<h2>Why homeowners choose us</h2><p>Rated 4.9 from 210 Google reviews. Upfront pricing: most drain cleanings are $189 flat. Every repair is guaranteed for 12 months.</p>
<h2>How much does a plumber cost in Sacramento?</h2><p>Most service calls are $89 plus parts; water heater installs start at $1,450. We quote before we start.</p>
<h2>Do you offer same-day service?</h2><p>Yes, for calls before 2 PM on weekdays.</p>
<blockquote>"Fixed our heater in an hour." — Maria G., Google review</blockquote>
${longText(20, "plumbing in Sacramento")}`,
        LB + `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"How much does a plumber cost in Sacramento?","acceptedAnswer":{"@type":"Answer","text":"Most service calls are $89 plus parts."}}]}</script>`,
      ),
    },
    "/services/water-heaters": {
      body: goodLayout(
        "Water Heater Repair & Installation Sacramento | Good Plumbing",
        "Water heater repair and installation in Sacramento: tank and tankless, gas and electric. Installs from $1,450, same-day repairs, 12-month guarantee.",
        `<h1>Water heater repair and installation in Sacramento</h1><p>We repair and replace tank and tankless water heaters in Sacramento homes, usually within a day. Installs start at $1,450 including haul-away.</p><h2>What is included</h2><ul><li>Permit</li><li>Haul-away</li><li>12-month guarantee</li></ul>${longText(25, "water heaters")}`,
        `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Service","name":"Water heater repair","provider":{"@type":"Plumber","name":"Good Plumbing"},"areaServed":"Sacramento"}</script><script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://good-plumbing.example/"},{"@type":"ListItem","position":2,"name":"Water heaters"}]}</script>`,
      ),
    },
    "/services/drain-cleaning": {
      body: goodLayout("Drain Cleaning Sacramento | Good Plumbing", "Drain cleaning in Sacramento: hydro jetting and snaking, $189 flat for most drains, same-day.", `<h1>Drain cleaning in Sacramento</h1><p>Hydro jetting and snaking for kitchen, bath and main lines. $189 flat for most drains.</p>${longText(25, "drain cleaning")}`, `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Service","name":"Drain cleaning"}</script>`),
    },
    "/service-areas": { body: goodLayout("Plumber Serving Sacramento & Elk Grove | Good Plumbing", "Service areas: Sacramento, Elk Grove, Rancho Cordova, Folsom and nearby.", `<h1>Areas we serve</h1><p>Sacramento, Elk Grove, Rancho Cordova, Folsom.</p>${longText(15, "service areas")}`) },
    "/about": { body: goodLayout("About Good Plumbing | Sacramento", "Family-owned since 2009, licensed and insured, 6 plumbers, one Sacramento shop.", `<h1>About Good Plumbing</h1><p>Family-owned since 2009. Six licensed plumbers. CA Lic #123456.</p>${longText(15, "the company")}`) },
    "/reviews": { body: goodLayout("Reviews | Good Plumbing Sacramento", "210 Google reviews, 4.9 average. Read what Sacramento homeowners say.", `<h1>Reviews</h1><p>4.9 from 210 Google reviews.</p><blockquote>"On time and honest." — D. Lee</blockquote>${longText(15, "reviews")}`) },
    "/faq": { body: goodLayout("Plumbing FAQ | Good Plumbing Sacramento", "Answers to the questions Sacramento homeowners ask before calling a plumber.", `<h1>Plumbing questions, answered</h1><h2>Do you charge for estimates?</h2><p>No.</p><h2>Are you licensed?</h2><p>Yes, CA Lic #123456.</p>${longText(15, "frequently asked questions")}`, `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Do you charge for estimates?","acceptedAnswer":{"@type":"Answer","text":"No."}},{"@type":"Question","name":"Are you licensed?","acceptedAnswer":{"@type":"Answer","text":"Yes, CA Lic #123456."}}]}</script>`) },
    "/contact": { body: goodLayout("Contact Good Plumbing | Sacramento", "Call (916) 555-0100 or request a quote online. 1 Main St, Sacramento, CA 95814.", `<h1>Contact us</h1><p>1 Main St, Sacramento, CA 95814 · (916) 555-0100</p><form method="post" action="/submit"><input name="name"><input name="phone" type="tel"><textarea name="msg"></textarea><button>Get a free quote</button></form>${longText(10, "contacting us")}`) },
    "/blog": { body: goodLayout("Plumbing Tips | Good Plumbing Blog", "Practical plumbing advice for Sacramento homeowners.", `<h1>Plumbing tips</h1><p>Posted September 1, 2026.</p>${longText(15, "plumbing tips")}`) },
  },
  fallback: { status: 404, body: "<!doctype html><html lang=\"en\"><head><title>Not found</title></head><body><h1>Page not found</h1></body></html>" },
};

/** A fetch implementation for one or more fake sites. */
export function fakeFetchFor(...sites: FakeSite[]): typeof fetch {
  const once = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const site = sites.find((s) => url.origin === s.origin || url.origin === s.origin.replace("https://", "http://") || url.origin === s.origin.replace("https://", "https://www."));
    if (!site) return new Response("no such host", { status: 502 });
    if (url.origin !== site.origin) {
      return new Response(null, { status: 301, headers: { location: site.origin + url.pathname + url.search } });
    }
    const route = site.routes[url.pathname] ?? site.fallback;
    const status = route.status ?? 200;
    const headers = new Headers({ "content-type": url.pathname.endsWith(".xml") ? "application/xml" : url.pathname.endsWith(".txt") ? "text/plain" : "text/html; charset=utf-8", ...(route.headers ?? {}) });
    if (headers.get("location")) headers.set("location", new URL(headers.get("location")!, site.origin).toString());
    const body = init?.method === "HEAD" ? null : (route.body ?? "");
    return new Response(status >= 300 && status < 400 ? null : body, { status, headers });
  };
  // Like real fetch: follow redirects unless redirect: "manual", and expose the final URL.
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    let current = String(input);
    for (let hop = 0; hop < 10; hop++) {
      const res = await once(current, init);
      const loc = res.headers.get("location");
      if (init?.redirect !== "manual" && res.status >= 300 && res.status < 400 && loc) {
        current = new URL(loc, current).toString();
        continue;
      }
      Object.defineProperty(res, "url", { value: current });
      return res;
    }
    throw new Error("too many redirects");
  }) as typeof fetch;
}
