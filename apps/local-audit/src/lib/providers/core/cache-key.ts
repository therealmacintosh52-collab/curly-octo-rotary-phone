import { createHash } from "node:crypto";

/**
 * Deterministic JSON: object keys sorted recursively, `undefined` dropped, so
 * two requests that mean the same thing hash the same.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = sortKeys(v);
    }
    return out;
  }
  return value;
}

export function cacheKey(provider: string, endpoint: string, request: unknown): string {
  return createHash("sha256").update(`${provider}\n${endpoint}\n${canonicalJson(request)}`).digest("hex");
}
