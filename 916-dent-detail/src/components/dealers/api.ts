// Tiny fetch helper for the dealer forms: JSON in, typed result out, never throws.
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string; message: string; fields?: { path: string; message: string }[] };

export async function postJson<T = unknown>(url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
    const j = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string; fields?: { path: string; message: string }[] } } & T;
    if (!res.ok) return { ok: false, status: res.status, code: j.error?.code ?? 'error', message: j.error?.message ?? 'Something went wrong. Please try again.', fields: j.error?.fields };
    return { ok: true, data: j as T };
  } catch {
    return { ok: false, status: 0, code: 'network', message: 'We could not reach the server. Check your connection and try again.' };
  }
}
