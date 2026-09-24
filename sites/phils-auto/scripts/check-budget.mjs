/**
 * The JS budget, measured by reachability rather than guessed from filenames.
 *
 * CRITICAL is what the HTML itself pulls: `<script type="module" src>` plus
 * anything it `<link rel="modulepreload">`s, followed transitively through
 * static `import` statements. That is what every visitor downloads to read
 * and use the page.
 *
 * DEFERRED is everything else in the bundle — chunks reachable only through a
 * dynamic `import()`, which on this site means the WebGL island: fetched only
 * by a tier-2+ device, only after LCP, and never on an inner page.
 *
 * Verified against a real browser by scripts/screenshots.mjs, which records
 * the requests a page actually makes.
 */
import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const BUDGET = { home: 250 * 1024, inner: 90 * 1024 };

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

const gz = (f) => gzipSync(readFileSync(f)).length;
const kb = (n) => (n / 1024).toFixed(1) + " KB";

/** Static imports only — a dynamic import() is deliberately not followed. */
function staticImports(file) {
  const src = readFileSync(file, "utf8");
  const found = new Set();
  // `import ... from "x"`, `import "x"`, `export ... from "x"`
  for (const m of src.matchAll(/(?:^|[\s;}])(?:import|export)\s[^;]*?from\s*["']([^"']+)["']/g))
    found.add(m[1]);
  for (const m of src.matchAll(/(?:^|[\s;}])import\s*["']([^"']+)["']/g)) found.add(m[1]);
  return [...found]
    .filter((s) => s.startsWith(".") || s.startsWith("/"))
    .map((s) => (s.startsWith("/") ? join(DIST, s) : resolve(dirname(file), s)))
    .filter((p) => existsSync(p));
}

function criticalSet(htmlFile) {
  const html = readFileSync(htmlFile, "utf8");
  const seeds = new Set();
  for (const m of html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)) seeds.add(m[1]);
  for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)) seeds.add(m[1]);

  const seen = new Set();
  const queue = [...seeds].map((s) => join(DIST, s)).filter(existsSync);
  while (queue.length) {
    const f = queue.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    queue.push(...staticImports(f));
  }
  return seen;
}

const pages = walk(DIST).filter((f) => f.endsWith(".html"));
const allJs = walk(DIST).filter((f) => f.endsWith(".js"));
const totalJs = allJs.reduce((n, f) => n + gz(f), 0);

let failed = false;
console.log("page".padEnd(34), "critical JS".padStart(12), "budget".padStart(10), "  result");
console.log("-".repeat(74));

for (const page of pages.sort()) {
  const route = "/" + relative(DIST, page).replace(/index\.html$/, "");
  const critical = [...criticalSet(page)];
  const size = critical.reduce((n, f) => n + gz(f), 0);
  const budget = route === "/" ? BUDGET.home : BUDGET.inner;
  const ok = size <= budget;
  if (!ok) failed = true;
  console.log(
    route.padEnd(34),
    kb(size).padStart(12),
    kb(budget).padStart(10),
    "  " + (ok ? "PASS" : "FAIL")
  );
  if (process.env.VERBOSE) {
    for (const f of critical.sort((a, b) => gz(b) - gz(a)))
      console.log("      ", relative(DIST, f).padEnd(48), kb(gz(f)).padStart(9));
  }
}

console.log("-".repeat(74));

const home = criticalSet(join(DIST, "index.html"));
const deferred = allJs.filter((f) => !home.has(f));
console.log(
  "Deferred (dynamic import only — the WebGL island):".padEnd(52),
  kb(deferred.reduce((n, f) => n + gz(f), 0)).padStart(10)
);
for (const f of deferred.sort((a, b) => gz(b) - gz(a)).slice(0, 6))
  console.log("      ", relative(DIST, f).padEnd(44), kb(gz(f)).padStart(9));
console.log("Everything in the bundle, if the scene loads:".padEnd(52), kb(totalJs).padStart(10));

process.exitCode = failed ? 1 : 0;
