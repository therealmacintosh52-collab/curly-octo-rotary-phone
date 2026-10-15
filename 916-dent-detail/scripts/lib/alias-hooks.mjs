// Node ESM resolve hook so plain `node` scripts can import the app's TypeScript (`@/…` alias, extensionless relative imports).
// Used by scripts/seed.mjs and scripts/setup-admin.mjs via scripts/lib/register-alias.mjs. Type stripping is built into Node 22.18+.
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');
const EXT = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
const tryFile = (base) => {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const e of EXT) if (existsSync(base + e)) return base + e;
  return null;
};

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const f = tryFile(join(src, specifier.slice(2)));
    if (f) return next(pathToFileURL(f).href, context);
  } else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:') && context.parentURL.includes('/src/')) {
    const f = tryFile(join(dirname(fileURLToPath(context.parentURL)), specifier));
    if (f) return next(pathToFileURL(f).href, context);
  }
  return next(specifier, context);
}
