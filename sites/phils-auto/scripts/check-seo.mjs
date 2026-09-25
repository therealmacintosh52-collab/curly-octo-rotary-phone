/**
 * Validates the built HTML against the rules in seo/keyword-map.md.
 *
 * The map claims titles and descriptions are enforced rather than eyeballed.
 * This is what enforces them, so the claim is true. It reads dist/, not the
 * source, because what ships is what matters — a description assembled from
 * three template variables can drift past 155 characters without any single
 * source line looking wrong.
 *
 * Exits non-zero on failure, so it can gate a build.
 */
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;

const LIMITS = {
  titleMax: 60,
  descMin: 70,
  descMax: 155,
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    statSync(p).isDirectory() ? walk(p, out) : p.endsWith(".html") && out.push(p);
  }
  return out;
}

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

const one = (html, re) => {
  const m = html.match(re);
  return m ? decode(m[1]).trim() : null;
};

const problems = [];
const seenTitles = new Map();
const seenDescs = new Map();
let checked = 0;

for (const file of walk(DIST).sort()) {
  const html = readFileSync(file, "utf8");
  const route = "/" + relative(DIST, file).replace(/index\.html$/, "");
  const fail = (msg) => problems.push(`${route}  ${msg}`);

  const noindex = /<meta[^>]+name="robots"[^>]+noindex/.test(html);

  const title = one(html, /<title>([\s\S]*?)<\/title>/);
  const desc = one(html, /<meta\s+name="description"\s+content="([^"]*)"/);
  const canonical = one(html, /<link\s+rel="canonical"\s+href="([^"]*)"/);
  const h1s = [...html.matchAll(/<h1[\s>]/g)].length;

  if (!title) fail("no <title>");
  else if (title.length > LIMITS.titleMax)
    fail(`title ${title.length} chars (max ${LIMITS.titleMax}): "${title}"`);

  if (!desc) fail("no meta description");
  else if (desc.length > LIMITS.descMax)
    fail(`description ${desc.length} chars (max ${LIMITS.descMax})`);
  else if (desc.length < LIMITS.descMin)
    fail(`description ${desc.length} chars (min ${LIMITS.descMin}) — too thin to earn the click`);

  if (!canonical) fail("no canonical");
  if (h1s !== 1) fail(`${h1s} <h1> elements (want exactly 1)`);

  for (const tag of ["og:title", "og:description", "og:image", "twitter:card"]) {
    if (!html.includes(`property="${tag}"`) && !html.includes(`name="${tag}"`))
      fail(`missing ${tag}`);
  }

  // Duplicates only matter for pages that can actually rank.
  if (!noindex) {
    if (title) {
      if (seenTitles.has(title)) fail(`title duplicates ${seenTitles.get(title)}`);
      else seenTitles.set(title, route);
    }
    if (desc) {
      if (seenDescs.has(desc)) fail(`description duplicates ${seenDescs.get(desc)}`);
      else seenDescs.set(desc, route);
    }
  }

  checked++;
}

console.log(`${checked} page(s) checked against seo/keyword-map.md`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log("  ✗ " + p);
  process.exitCode = 1;
} else {
  console.log("titles ≤60, descriptions 70–155, one H1, canonical and social tags on every page.");
}
