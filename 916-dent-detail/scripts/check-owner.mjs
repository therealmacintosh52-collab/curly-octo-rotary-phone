#!/usr/bin/env node
// Launch gate: lists every owner placeholder still in the app, GROUPED BY CATEGORY with counts. Exit 1 while any remain.
//   npm run check:owner                 grouped report
//   npm run check:owner -- --json       machine-readable ({ total, categories, filtered })
//   npm run check:owner -- --show-filtered   also list the lines that match a pattern but are NOT placeholders, with the reason
//
// A line is counted when it still holds an owner decision: a `[OWNER...]` marker that is text or a comment about a value, a config value that is
// still null/empty, a `placeholder: true` flag, the fictional contact details in config/site.ts. A line that merely MATCHES a pattern but is
// ordinary code is filtered out and the filter is reported (never silently): `: null` in application logic, the code that strips or renders a
// marker, demo accounts and test fixtures that use example.com / 555 numbers, input hints such as "(916) 555-0123".
// When an owner value is replaced, its line stops matching; marker-renderer lines never need to change.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const json = process.argv.includes('--json');
const showFiltered = process.argv.includes('--show-filtered');

const PATTERNS = [/\[OWNER[^\]]*\]/, /\[REPLACE WITH REAL JOB PHOTOS\]/, /placeholder: true/, /: null(,| as)/, /555-01\d\d/, /example\.com/];
const isConfigFile = (f) => /^src\/(config|content)\//.test(f);
// comments that only POINT at an owner value or at TODO.md (the value itself is counted on its own line)
const POINTER = /(listed in TODO|Anything marked \[OWNER\]|Values marked \[OWNER\]|are flagged \[OWNER\] confirm|\[OWNER\] items are listed|\(\[OWNER\] production domain\)|an \[OWNER\] placeholder\)|is an \[OWNER\] placeholder so the demo|renders an \[OWNER\] marker|show a visible \[OWNER\] confirm marker)/;
const isComment = (t) => /^(\/\/|\*|\/\*|\{\/\*)/.test(t);

const CATEGORIES = [
  ['Business facts', 'phone, email, hours, domain, review link, social profiles (src/config/site.ts)'],
  ['Prices & offers', 'from-prices, memberships, add-ons, deposit, travel, dealer wholesale (src/config/pricing.ts)'],
  ['Booking policy & durations', 'job durations, panel timing, deposit/change policy (src/config/booking.ts)'],
  ['Claims to confirm', 'dealer same-day and COI claims (src/content/dealers.ts)'],
  ['Proof (photos, reviews, claims)', 'real job photos, real reviews, eco claim wording (src/components/sections)'],
  ['Legal & counsel', 'privacy, terms, SMS wording: counsel review'],
  ['Technicians (demo seed)', 'mock-store technician names; live technicians come from Supabase'],
  ['Other notes', '[OWNER] notes elsewhere in code'],
];

/** -> { cat } for a real placeholder, { filtered } with a reason for a pattern hit that is not one, or null when no pattern matches. */
function classify(file, line) {
  const t = line.trim();
  if (!PATTERNS.some((re) => re.test(t))) return null;

  // ---- not placeholders
  if (isComment(t) && POINTER.test(t)) return { filtered: 'documentation comment that points at an owner value counted on its own line / TODO.md' };
  if (/\.replace\('\[OWNER\] '/.test(t)) return { filtered: 'code that strips the [OWNER] prefix from demo names' };
  if (/owner-mark|\[OWNER\]/.test(t) && !isComment(t) && /(&&|===|\?\?|\? )/.test(t) && /(placeholder|PLACEHOLDER|=== null|\?\?|claimsConfirmed|time)/.test(t) && !/real review|REPLACE WITH REAL/.test(t)) {
    return { filtered: 'marker renderer (only draws the marker while the config value above is unset)' };
  }
  if (/if \(v === null\)/.test(t) && /\[OWNER\] price/.test(t)) return { filtered: 'marker renderer (priceText)' };
  if (file === 'src/components/sections/PlaceholderArt.tsx') return { filtered: 'component that draws the placeholder stamp (usage is counted in Sections.tsx)' };
  if (file.startsWith('src/lib/concierge/mock-model') || /^src\/lib\/dealers\/auth\.ts$/.test(file)) return { filtered: 'offline test policy / demo dealer account fixture' };
  if (/placeholder="/.test(t) && !/\[OWNER/.test(t)) return { filtered: 'input hint text (e.g. "(916) 555-0123"), not a stored value' };
  if (PATTERNS[4].test(t) || PATTERNS[5].test(t)) {
    if (file !== 'src/config/site.ts' && !/\[OWNER/.test(t)) return { filtered: 'example.com / 555 number outside config/site.ts (demo account, doc comment or fixture)' };
  }
  if (/: null(,| as)/.test(t) && !/\[OWNER/.test(t) && !/placeholder: true/.test(t)) {
    // `key: null` is an unset owner value only in the config/content tables; everywhere else it is ordinary application logic
    if (!isConfigFile(file)) return { filtered: '`: null` in application logic (not config)' };
    if (/^src\/config\/(site|pricing)\.ts$/.test(file) && !isComment(t)) {
      // config tables: real
    } else if (file === 'src/content/seo/services/dealership-recon.ts' || /priceKey: null/.test(t)) {
      return { filtered: 'priceKey: null means "this service page shows no price", a design choice' };
    } else if (!isComment(t)) {
      return { filtered: '`: null` in a content table that is not an owner value' };
    }
  }
  if (file === 'src/config/pricing.ts' && /export type Money/.test(t)) return { filtered: 'type declaration comment' };

  // ---- real placeholders: pick a category
  let cat;
  if (file === 'src/config/site.ts') cat = 'Business facts';
  else if (file === 'src/config/pricing.ts' || file === 'src/lib/memberships/index.ts') cat = 'Prices & offers';
  else if (file === 'src/config/booking.ts') cat = 'Booking policy & durations';
  else if (file === 'src/content/dealers.ts') cat = 'Claims to confirm';
  else if (/^src\/components\/sections\//.test(file)) cat = 'Proof (photos, reviews, claims)';
  else if (/^src\/app\/(privacy|terms)\//.test(file) || file === 'src/components/LegalPage.tsx' || file === 'src/lib/concierge/consent.ts') cat = 'Legal & counsel';
  else if (file === 'src/lib/db/seed.ts' || file === 'src/lib/auth/config.ts') cat = 'Technicians (demo seed)';
  else if (/^src\/app\/(dealers|book)\//.test(file) || file.startsWith('src/components/dealers/') || file === 'src/components/Footer.tsx') return { filtered: 'marker renderer (only draws the marker while the config value is unset)' };
  else cat = 'Other notes';
  return { cat };
}

/** Values that are only placeholders by their *meaning* (a flag, an empty string), so no marker text exists to match. */
function explicitChecks(file, line) {
  const t = line.trim();
  if (file === 'src/config/pricing.ts' && /^export const PRICES_ARE_PLACEHOLDERS = true/.test(t)) return { cat: 'Prices & offers', note: 'PRICES_ARE_PLACEHOLDERS is still true' };
  if (file === 'src/content/dealers.ts' && /claimsConfirmed = \{[^}]*false/.test(t)) return { cat: 'Claims to confirm', note: 'claimsConfirmed.sameDay / .coi are false' };
  if (file === 'src/config/site.ts' && /^googleReviewUrl: ''/.test(t)) return { cat: 'Business facts', note: 'googleReviewUrl is empty' };
  if (file === 'src/config/site.ts' && /^social: \{[^}]*''/.test(t)) return { cat: 'Business facts', note: 'social profile URLs are empty' };
  return null;
}

const real = new Map(CATEGORIES.map(([c]) => [c, []]));
const filtered = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (f !== 'generated') walk(p); continue; }
    if (!/\.(tsx?|mjs)$/.test(f)) continue;
    const rel = relative(ROOT, p);
    readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
      const loc = `${rel}:${i + 1}`;
      const x = explicitChecks(rel, line);
      if (x) real.get(x.cat).push({ loc, text: x.note });
      const c = classify(rel, line);
      if (!c) return;
      if (c.cat) real.get(c.cat).push({ loc, text: line.trim().slice(0, 110) });
      else filtered.push({ loc, reason: c.filtered, text: line.trim().slice(0, 90) });
    });
  }
};
walk(join(ROOT, 'src'));

const total = [...real.values()].reduce((s, a) => s + a.length, 0);
const byReason = filtered.reduce((m, f) => m.set(f.reason, (m.get(f.reason) ?? 0) + 1), new Map());

if (json) {
  console.log(JSON.stringify({ total, categories: Object.fromEntries([...real].map(([k, v]) => [k, v.length])), filtered: Object.fromEntries(byReason) }, null, 2));
} else {
  for (const [cat, blurb] of CATEGORIES) {
    const items = real.get(cat);
    if (!items.length) continue;
    console.log(`\n== ${cat} (${items.length}): ${blurb}`);
    for (const it of items) console.log(`   ${it.loc}  ${it.text}`);
  }
  console.log('\nSummary');
  for (const [cat] of CATEGORIES) console.log(`  ${String(real.get(cat).length).padStart(4)}  ${cat}`);
  console.log(`  ${String(total).padStart(4)}  TOTAL owner placeholder line(s) remain.`);
  console.log(`\nIgnored as not-placeholders (${filtered.length} lines matched a pattern but are ordinary code or test data):`);
  for (const [r, n] of [...byReason].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${r}`);
  if (showFiltered) for (const f of filtered) console.log(`   [filtered] ${f.loc}  (${f.reason})  ${f.text}`);
  else console.log('  (run with --show-filtered to list them)');
}
process.exit(total ? 1 : 0);
