import { ev, home, keyPages, pct, shortUrl, siteCheck } from "./util";

const C = "images" as const;

siteCheck({
  id: "alt_missing",
  problem: "Images have no alt text",
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
    return share > 20 ? { plain_english: `${share}% of images (${missing.length} of ${imgs.length}) have no alt text.`, evidence: missing.slice(0, 5).map(({ i, p }) => ev(shortUrl(i.src), p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "alt_generic",
  problem: "Alt text is a placeholder or a filename",
  category: C,
  title: "Alt text is descriptive",
  description: "'image', 'photo' or the filename as alt text is the same as none.",
  severity: "low",
  impact: 20,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).flatMap((p) => p.images.filter((i) => i.alt && (/^(image|img|photo|picture|logo|icon|banner|untitled|dsc|img_)?[\s\d_-]*$/i.test(i.alt.trim()) || /\.(jpe?g|png|webp|gif)$/i.test(i.alt.trim()))).map((i) => ({ i, p })));
    return bad.length ? { plain_english: `${bad.length} image(s) have placeholder alt text such as "image" or a filename.`, evidence: bad.slice(0, 5).map(({ i, p }) => ev(`alt="${i.alt}" on ${shortUrl(i.src)}`, p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "generic_filenames",
  problem: "Images keep camera or screenshot filenames",
  category: C,
  title: "Image filenames describe the photo",
  description: "IMG_2041.jpg tells Google nothing; sacramento-water-heater-install.jpg does.",
  severity: "low",
  impact: 15,
  fix: "easy",
  run: (site) => {
    const bad = keyPages(site).flatMap((p) => p.images.filter((i) => /\/(img|dsc|dscn|dcim|image|photo|screenshot|screen shot|untitled|pxl|mvimg)[-_ ]?\d+/i.test(i.src) || /\/\d{6,}\.(jpe?g|png|webp)$/i.test(i.src)).map((i) => ({ i, p })));
    return bad.length ? { plain_english: `${bad.length} image(s) still have camera or screenshot filenames.`, evidence: bad.slice(0, 5).map(({ i, p }) => ev(shortUrl(i.src), p.finalUrl)) } : "pass";
  },
});

siteCheck({
  id: "oversized_files",
  problem: "Images are far too heavy",
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
    return { plain_english: `${heavy.length} image(s) on the home page weigh over 300 KB each (${total} KB together). Resize to the display size and export as WebP.`, evidence: heavy.slice(0, 6).map((i) => ev(`${Math.round((i.bytes ?? 0) / 1024)} KB · ${shortUrl(i.src)}`, i.foundOn)), severity: total > 1500 ? "high" : "medium" };
  },
});

siteCheck({
  id: "legacy_formats",
  problem: "Images use legacy formats with no WebP/AVIF",
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
    return pct(legacy.length, imgs.length) > 60 ? { plain_english: `${pct(legacy.length, imgs.length)}% of images are JPEG/PNG with no WebP/AVIF alternative.`, evidence: [ev(`${legacy.length} of ${imgs.length} raster images in legacy formats`, home(site).finalUrl)] } : "pass";
  },
});

siteCheck({
  id: "lazy_loading_missing",
  problem: "Below-the-fold images do not lazy-load",
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
    return pct(eager.length, below.length) > 70 ? { plain_english: `${eager.length} of ${below.length} lower images on the home page load eagerly. Add loading="lazy".`, evidence: [ev(`${eager.length}/${below.length} without loading=lazy`, h.finalUrl)] } : "pass";
  },
});

siteCheck({
  id: "dimensions_missing",
  problem: "Images have no width and height",
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
    return pct(missing.length, imgs.length) > 50 ? { plain_english: `${pct(missing.length, imgs.length)}% of images have no width/height attributes, a common cause of layout shift.`, evidence: [ev(`${missing.length} of ${imgs.length} images without dimensions`, home(site).finalUrl)] } : "pass";
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
    return photos.length < 2 ? { plain_english: `The home page has ${photos.length} photo(s). Add real photos: the storefront or truck, the team, work in progress, finished jobs.`, evidence: [ev(`${h.images.length} images total, ${photos.length} likely photos`, h.finalUrl)] } : "pass";
  },
});

siteCheck({
  id: "logo_missing",
  problem: "No logo image found",
  category: C,
  title: "A logo image is present",
  description: "Google and AI engines pick the logo from the page and the schema; a text-only header gives them nothing.",
  severity: "low",
  impact: 15,
  fix: "easy",
  run: (site) => {
    const h = home(site);
    const logo = h.images.some((i) => /logo/i.test(i.src) || /logo/i.test(i.alt ?? "")) || h.jsonLd.some((b) => b.parsed && ("logo" in b.parsed || "image" in b.parsed));
    return logo ? "pass" : { plain_english: "No logo image was found on the home page or in the schema.", evidence: [ev(`images: ${h.images.map((i) => shortUrl(i.src)).slice(0, 5).join(", ") || "none"}`, h.finalUrl)] };
  },
});
