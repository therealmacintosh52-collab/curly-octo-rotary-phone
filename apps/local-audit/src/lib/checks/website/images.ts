import { count, ev, home, keyPages, pct, shortUrl, siteCheck, v } from "./util";

const C = "images" as const;

siteCheck({
  id: "alt_missing",
  problem: "Pictures have no description",
  category: C,
  title: "Images have alt text",
  description: "Alt text is how Google Images and screen readers understand a photo; it is also a ranking hint for the page.",
  severity: "medium",
  impact: 40,
  fix: "easy",
  run: (site) => {
    const imgs = keyPages(site).flatMap((p) => p.images.map((i) => ({ i, p })));
    if (!imgs.length) return { unavailable: "no images found" };
    const missing = imgs.filter(({ i }) => i.alt === null || i.alt.trim() === "");
    const share = pct(missing.length, imgs.length);
    return share > 20 ? { plain_english: `${share}% of your pictures (${missing.length} of ${imgs.length}) have no description attached. Google Images cannot show them, and blind visitors hear nothing.`, evidence: missing.slice(0, 5).map(({ i, p }) => ev(shortUrl(i.src), p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "alt_generic",
  problem: "Picture descriptions are placeholders",
  category: C,
  title: "Alt text is descriptive",
  description: "'image', 'photo' or the filename as alt text is the same as none.",
  severity: "low",
  impact: 20,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).flatMap((p) => p.images.filter((i) => i.alt && (/^(image|img|photo|picture|logo|icon|banner|untitled|dsc|img_)?[\s\d_-]*$/i.test(i.alt.trim()) || /\.(jpe?g|png|webp|gif)$/i.test(i.alt.trim()))).map((i) => ({ i, p })));
    return bad.length ? { plain_english: `${count(bad.length, "picture")} ${v(bad.length, "are")} described only as "image" or by a filename, which is the same as no description.`, evidence: bad.slice(0, 5).map(({ i, p }) => ev(`alt="${i.alt}" on ${shortUrl(i.src)}`, p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "generic_filenames",
  problem: "Pictures keep camera filenames",
  category: C,
  title: "Image filenames describe the photo",
  description: "IMG_2041.jpg tells Google nothing; sacramento-water-heater-install.jpg does.",
  severity: "low",
  impact: 15,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).flatMap((p) => p.images.filter((i) => /\/(img|dsc|dscn|dcim|image|photo|screenshot|screen shot|untitled|pxl|mvimg)[-_ ]?\d+/i.test(i.src) || /\/\d{6,}\.(jpe?g|png|webp)$/i.test(i.src)).map((i) => ({ i, p })));
    return bad.length ? { plain_english: `${count(bad.length, "picture")} still ${v(bad.length, "carry")} camera names like IMG_2041. Google reads filenames; a descriptive name would help you show up in image searches.`, evidence: bad.slice(0, 5).map(({ i, p }) => ev(shortUrl(i.src), p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "oversized_files",
  problem: "Pictures are far too heavy",
  category: C,
  title: "Images are compressed",
  description: "A single 2 MB hero image can double the load time on mobile.",
  severity: "high",
  impact: 55,
  fix: "easy",
  run: (site) => {
    if (!site.imageProbes.length) return { unavailable: "no image sizes measured" };
    const heavy = site.imageProbes.filter((i) => (i.bytes ?? 0) > 300_000);
    if (!heavy.length) return "pass";
    const total = Math.round(heavy.reduce((s, i) => s + (i.bytes ?? 0), 0) / 1024);
    return { plain_english: `${count(heavy.length, "picture")} on your home page weigh over 300 KB each (${total} KB together). On a phone that is several seconds of waiting before the page appears.`, evidence: heavy.slice(0, 6).map((i) => ev(`${Math.round((i.bytes ?? 0) / 1024)} KB · ${shortUrl(i.src)}`, i.foundOn)), severity: total > 1500 ? "high" : "medium" };
  },
});

siteCheck({
  id: "legacy_formats",
  problem: "Pictures use old, heavy formats",
  category: C,
  title: "Modern image formats are used",
  description: "WebP/AVIF are 30–50% smaller than JPEG/PNG at the same quality.",
  severity: "low",
  impact: 25,
  fix: "easy",
  run: (site) => {
    const imgs = keyPages(site).flatMap((p) => p.images).filter((i) => i.format && i.format !== "svg");
    if (imgs.length < 3) return { unavailable: "too few raster images to judge" };
    const legacy = imgs.filter((i) => (i.format === "jpg" || i.format === "png" || i.format === "gif") && !i.hasSrcset && !i.inPicture);
    return pct(legacy.length, imgs.length) > 60 ? { plain_english: `${pct(legacy.length, imgs.length)}% of your pictures use old file formats that are 30–50% heavier than they need to be, which slows every page.`, evidence: [ev(`${legacy.length} of ${imgs.length} raster images in legacy formats`, home(site).finalUrl)] } : "pass";
  },
});

siteCheck({
  id: "lazy_loading_missing",
  problem: "Lower pictures load before they are needed",
  category: C,
  title: "Below-the-fold images lazy-load",
  description: "loading=\"lazy\" on images further down the page keeps the first screen fast.",
  severity: "low",
  impact: 20,
  fix: "easy",
  run: (site) => {
    const h = home(site);
    const below = h.images.filter((i) => i.index >= 2);
    if (below.length < 3) return { unavailable: "home page has too few images to judge" };
    const eager = below.filter((i) => i.loading !== "lazy");
    return pct(eager.length, below.length) > 70 ? { plain_english: `${eager.length} of ${below.length} pictures further down your home page load immediately, before anyone scrolls to them, which slows the top of the page.`, evidence: [ev(`${eager.length}/${below.length} without loading=lazy`, h.finalUrl)] } : "pass";
  },
});

siteCheck({
  id: "dimensions_missing",
  problem: "Pictures do not declare their size, so the page jumps",
  category: C,
  title: "Images declare width and height",
  description: "Without dimensions the page jumps as images load (layout shift), which Google measures as CLS.",
  severity: "low",
  impact: 25,
  fix: "easy",
  run: (site) => {
    const imgs = keyPages(site).flatMap((p) => p.images);
    if (imgs.length < 2) return { unavailable: "too few images to judge" };
    const missing = imgs.filter((i) => !i.width || !i.height);
    return pct(missing.length, imgs.length) > 50 ? { plain_english: `${pct(missing.length, imgs.length)}% of your pictures do not tell the browser their size, so the page jumps around as they load and visitors tap the wrong thing.`, evidence: [ev(`${missing.length} of ${imgs.length} images without dimensions`, home(site).finalUrl)] } : "pass";
  },
});

siteCheck({
  id: "too_few_photos",
  problem: "Almost no real photos on the home page",
  category: C,
  title: "Real photos on the home page",
  description: "Pages with real photos of the team, the shop and the work convert better and rank in Google Images; icons alone look like a template.",
  severity: "medium",
  impact: 35,
  fix: "medium",
  run: (site) => {
    const h = home(site);
    const photos = h.images.filter((i) => i.format !== "svg" && !/logo|icon|badge|sprite|pixel|tracking/i.test(i.src));
    return photos.length < 2 ? { plain_english: `Your home page has ${count(photos.length, "real photo")}. Sites with photos of the team, the shop and finished work get more calls; icons alone look like a template.`, evidence: [ev(`${h.images.length} images total, ${photos.length} likely photos`, h.finalUrl)] } : "pass";
  },
});

siteCheck({
  id: "logo_missing",
  problem: "No logo found on the home page",
  category: C,
  title: "A logo image is present",
  description: "Google and AI engines pick the logo from the page and the schema; a text-only header gives them nothing.",
  severity: "low",
  impact: 15,
  fix: "easy",
  run: (site) => {
    const h = home(site);
    const logo = h.images.some((i) => /logo/i.test(i.src) || /logo/i.test(i.alt ?? "")) || h.jsonLd.some((b) => b.parsed && ("logo" in b.parsed || "image" in b.parsed));
    return logo ? "pass" : { plain_english: "We could not find your logo on the home page. Google and AI assistants pick it up from the page to show next to your name.", evidence: [ev(`images: ${h.images.map((i) => shortUrl(i.src)).slice(0, 5).join(", ") || "none"}`, h.finalUrl)] };
  },
});
