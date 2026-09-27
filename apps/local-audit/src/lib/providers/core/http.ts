import { parseRetryAfter, ProviderHttpError, ProviderNetworkError, ProviderTimeout } from "./errors";

export interface FetchJsonOptions {
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

export interface JsonResponse<T = unknown> {
  status: number;
  headers: Headers;
  body: T;
}

/**
 * fetch + AbortController timeout + JSON body. Non-2xx throws ProviderHttpError
 * (with Retry-After parsed), aborts throw ProviderTimeout, everything else
 * ProviderNetworkError. Never caches at the fetch layer; raw_snapshots is the cache.
 */
export async function fetchJson<T = unknown>(url: string, init: RequestInit, { timeoutMs, fetchImpl = fetch }: FetchJsonOptions): Promise<JsonResponse<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetchImpl(url, { ...init, signal: controller.signal, cache: "no-store" });
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") throw new ProviderTimeout(timeoutMs);
    throw new ProviderNetworkError(err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let body: unknown = text;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      // keep text
    }
  }
  if (!res.ok) {
    throw new ProviderHttpError(res.status, body, parseRetryAfter(res.headers.get("retry-after")));
  }
  return { status: res.status, headers: res.headers, body: body as T };
}
