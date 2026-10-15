// Browser-side helpers for the concierge widget: SSE parsing, tolerant localStorage, API calls.
import type { UiBlock } from '@/lib/concierge/types';

export type ChatMsg = { id: string; role: 'user' | 'assistant'; text: string; thumbs?: string[]; ui?: UiBlock[]; streaming?: boolean; error?: boolean };
export type Saved = { conversationId: string; sessionToken: string };

const KEY = 'd916_concierge_v1';
export const loadSaved = (): Saved | null => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null; return v?.conversationId && v.sessionToken ? v : null; } catch { return null; } };
export const saveSaved = (s: Saved | null) => { try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch { /* private mode: chat still works, it just will not survive a reload */ } };

export type SseEvent = { event: string; data: Record<string, unknown> };
export async function* sseEvents(res: Response): AsyncGenerator<SseEvent> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const raw = buf.slice(0, i); buf = buf.slice(i + 2);
      const event = /^event: (.*)$/m.exec(raw)?.[1];
      const data = /^data: (.*)$/m.exec(raw)?.[1];
      if (event && data) { try { yield { event, data: JSON.parse(data) as Record<string, unknown> }; } catch { /* skip a broken frame */ } }
    }
  }
}

export const TOOL_STATUS: Record<string, string> = {
  get_services: 'Looking that up…', check_service_area: 'Checking your area…', get_quote_range: 'Looking at your photos…',
  check_availability: 'Checking real openings…', create_booking: 'Holding that time…', send_deposit_link: 'Getting your secure link…',
  lookup_booking: 'Finding your booking…', reschedule_booking: 'Moving your booking…', cancel_booking: 'Checking the details…',
  create_lead: 'Saving your details…', escalate_to_human: 'Bringing in the owners…',
};

export async function uploadPhoto(blob: Blob): Promise<string> {
  const fd = new FormData();
  fd.append('file', blob, 'photo.jpg');
  const res = await fetch('/api/photos', { method: 'POST', body: fd });
  const j = (await res.json().catch(() => ({}))) as { path?: string; error?: { message?: string } };
  if (!res.ok || !j.path) throw new Error(j.error?.message ?? 'That photo could not be uploaded.');
  return j.path;
}
