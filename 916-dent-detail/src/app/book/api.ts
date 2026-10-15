// Tiny fetch wrapper for the booking API. Never throws; returns { ok, data } or { ok:false, error }.
export type ApiErr = { code: string; message: string; fields?: { path: string; message: string }[] };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiErr; status: number };

export async function api<T>(url: string, init?: { method?: 'GET' | 'POST'; body?: unknown; headers?: Record<string, string> }): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init?.method ?? (init?.body ? 'POST' : 'GET'),
      headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(init?.headers ?? {}) },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, error: json?.error ?? { code: 'error', message: 'Something went wrong. Please try again.' } };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, status: 0, error: { code: 'network', message: "We couldn't reach the server. Check your connection and try again." } };
  }
}
