// Offline-tolerant writes for the tech view. A change is POSTed right away; if the phone is offline (or the network
// call throws) it is parked in localStorage and replayed in order when connectivity returns. Every queued body carries
// a client-generated `opId`; the server treats a repeat of the same operation as a no-op, so a replay after a flaky
// response cannot double-apply. Photos are NOT queued (too big for localStorage): the UI asks to retry.
const KEY = 'd916_outbox_v1';
const EVT = 'd916-outbox';
export type Queued = { opId: string; url: string; body: Record<string, unknown>; label: string; at: number; tries: number };

const read = (): Queued[] => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Queued[]; } catch { return []; }
};
const write = (q: Queued[]) => {
  try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* storage full or blocked: nothing more we can do */ }
  window.dispatchEvent(new Event(EVT));
};

export const outboxSize = (): number => (typeof window === 'undefined' ? 0 : read().length);
export function subscribeOutbox(fn: () => void): () => void {
  window.addEventListener(EVT, fn);
  return () => window.removeEventListener(EVT, fn);
}
export const newOpId = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export type PostResult<T = unknown> = { ok: true; queued: false; data: T } | { ok: true; queued: true } | { ok: false; status: number; message: string };

async function send(url: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
}

export async function postJson<T = unknown>(url: string, body: Record<string, unknown>, opts: { label: string; queueable?: boolean }): Promise<PostResult<T>> {
  const opId = (body.opId as string | undefined) ?? newOpId();
  const full = { ...body, opId };
  const enqueue = (): PostResult<T> => { write([...read(), { opId, url, body: full, label: opts.label, at: Date.now(), tries: 0 }]); return { ok: true, queued: true }; };
  if (opts.queueable && typeof navigator !== 'undefined' && !navigator.onLine) return enqueue();
  try {
    const res = await send(url, full);
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & T;
    if (res.ok) return { ok: true, queued: false, data: json as T };
    return { ok: false, status: res.status, message: json.error?.message ?? 'Request failed.' };
  } catch {
    if (opts.queueable) return enqueue();
    return { ok: false, status: 0, message: 'No connection. Try again when you have signal.' };
  }
}

let flushing = false;
/** Replay queued changes in order. Stops at the first network failure; drops items the server rejects (4xx). */
export async function flushOutbox(): Promise<void> {
  if (flushing || typeof window === 'undefined' || !navigator.onLine) return;
  flushing = true;
  try {
    for (;;) {
      const q = read();
      const item = q[0];
      if (!item) break;
      let res: Response;
      try { res = await send(item.url, item.body); } catch { break; }
      if (res.status === 401) break; // signed out: keep everything until they sign back in
      if (res.ok || (res.status >= 400 && res.status < 500) || item.tries >= 5) write(read().filter((x) => x.opId !== item.opId));
      else { write(read().map((x) => (x.opId === item.opId ? { ...x, tries: x.tries + 1 } : x))); break; }
    }
    if (read().length === 0) window.dispatchEvent(new Event('d916-synced'));
  } finally { flushing = false; }
}
