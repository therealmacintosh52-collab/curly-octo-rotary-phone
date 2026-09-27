import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Fixture files live in src/lib/providers/__fixtures__/<provider>/<name>.json.
 * They are synthetic unless `recorded_at` is set by record mode, and they are
 * never presented to a client as measured data: the note field says so.
 */
export interface Fixture<T = unknown> {
  request: unknown;
  response: T;
  cost_usd: number;
  recorded_at: string | null;
  note: string;
}

const ROOT = path.resolve(process.cwd(), "src/lib/providers/__fixtures__");

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._:-]/g, "_").replace(/:/g, "__");
}

export function fixturePath(provider: string, name: string, root = ROOT) {
  return path.join(root, provider, `${safeName(name)}.json`);
}

export async function loadFixture<T = unknown>(provider: string, name: string, root = ROOT): Promise<Fixture<T> | null> {
  try {
    const text = await readFile(fixturePath(provider, name, root), "utf8");
    return JSON.parse(text) as Fixture<T>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw err;
  }
}

export async function saveFixture<T = unknown>(provider: string, name: string, fixture: Fixture<T>, root = ROOT): Promise<string> {
  const file = fixturePath(provider, name, root);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(fixture, null, 2) + "\n", "utf8");
  return file;
}
