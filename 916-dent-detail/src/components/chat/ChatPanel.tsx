'use client';
/* eslint-disable @next/next/no-img-element -- previews are local data: URLs, nothing for next/image to optimise */
// 916 Concierge chat dialog. Mobile: full-height sheet. Desktop: bottom-right panel. Accessible modal dialog (focus trap,
// Escape, focus return), live announcements for finished replies, streaming over SSE from /api/chat, photo upload that
// feeds the quote tool, quick-reply chips, persisted conversation, reduced-motion aware.
import { useCallback, useEffect, useRef, useState } from 'react';
import { prepPhoto } from '@/app/book/image';
import { getAttribution } from '@/lib/attribution';
import type { UiBlock } from '@/lib/concierge/types';
import { Cards } from './Cards';
import { TOOL_STATUS, loadSaved, saveSaved, sseEvents, uploadPhoto, type ChatMsg, type Saved } from './client';

const GREETING = "Hi, I'm the 916 Concierge, the AI assistant for 916 Dent & Detail. Send a photo of the dent for a price range, or tell me what your car needs.";
const START_CHIPS = ['Get a price from a photo', 'Book a time', 'Check my booking', 'Do you come to my area?'];
const MAX_PHOTOS = 4;
const MAX_CHARS = 1000;
let uid = 0;
const nid = () => `m${Date.now().toString(36)}${(uid++).toString(36)}`;

type Pending = { id: string; thumb: string; path?: string; status: 'uploading' | 'ready' | 'error'; error?: string };

export default function ChatPanel({ onClose }: { onClose: () => void }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([{ id: 'greet', role: 'assistant', text: GREETING }]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [chips, setChips] = useState<string[]>(START_CHIPS);
  const [announce, setAnnounce] = useState('');
  const saved = useRef<Saved | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const logEl = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const reduced = useRef(false);

  // ---- mount: restore a previous conversation, focus the input
  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const s = loadSaved();
    saved.current = s;
    if (s) {
      fetch(`/api/concierge/history?c=${encodeURIComponent(s.conversationId)}`, { headers: { 'x-concierge-session': s.sessionToken } })
        .then(async (r) => {
          if (!r.ok) { saveSaved(null); saved.current = null; return; }
          const j = (await r.json()) as { messages: { role: 'user' | 'assistant'; text: string }[] };
          if (j.messages.length) { setMsgs([{ id: 'greet', role: 'assistant', text: GREETING }, ...j.messages.map((m) => ({ id: nid(), role: m.role, text: m.text }))]); setChips([]); }
        })
        .catch(() => undefined);
    }
    area.current?.focus();
    document.documentElement.style.overflow = 'hidden'; // the page behind a modal does not scroll
    return () => { document.documentElement.style.overflow = ''; };
  }, []);

  useEffect(() => { logEl.current?.scrollTo({ top: logEl.current.scrollHeight, behavior: reduced.current ? 'auto' : 'smooth' }); }, [msgs, status]);

  // ---- modal behaviour: Escape closes, Tab stays inside
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !root.current) return;
      const f = [...root.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),textarea,input:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0]!; const last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const patchLast = useCallback((fn: (m: ChatMsg) => ChatMsg) => setMsgs((all) => all.map((m, i) => (i === all.length - 1 ? fn(m) : m))), []);

  const send = useCallback(async (textIn?: string) => {
    const attachments = pending.filter((p) => p.status === 'ready' && p.path);
    const text = (textIn ?? input).trim() || (attachments.length ? 'Here are photos of the damage.' : '');
    if (!text || busy || pending.some((p) => p.status === 'uploading')) return;
    setBusy(true); setInput(''); setChips([]); setStatus('');
    if (area.current) area.current.style.height = 'auto';
    setMsgs((all) => [...all, { id: nid(), role: 'user', text, thumbs: attachments.map((a) => a.thumb) }, { id: nid(), role: 'assistant', text: '', streaming: true }]);
    setPending([]);
    const attr = getAttribution();
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify({
          message: text, conversationId: saved.current?.conversationId, sessionToken: saved.current?.sessionToken,
          attachments: attachments.map((a) => ({ path: a.path })), attribution: { first: attr.first, last: attr.last },
        }),
      });
      if (res.status === 401) { saveSaved(null); saved.current = null; throw new Error('Your chat session expired, so I started fresh. Please send that again.'); }
      if (res.status === 429) throw new Error('You are sending messages faster than I can keep up. Give me a minute.');
      if (!res.ok || !res.body) throw new Error('Something went wrong. Please try again or text us.');
      let acc = '';
      for await (const ev of sseEvents(res)) {
        if (ev.event === 'status') setStatus(TOOL_STATUS[String(ev.data.tool)] ?? 'Working on it…');
        else if (ev.event === 'delta') { setStatus(''); acc += String(ev.data.text); const t = acc; patchLast((m) => ({ ...m, text: t })); }
        else if (ev.event === 'error') throw new Error(String(ev.data.message));
        else if (ev.event === 'done') {
          const d = ev.data as { conversationId: string; sessionToken?: string; reply: string | null; ui: UiBlock[]; suggestions: string[] };
          if (d.sessionToken) { saved.current = { conversationId: d.conversationId, sessionToken: d.sessionToken }; saveSaved(saved.current); }
          const reply = d.reply ?? acc;
          patchLast((m) => ({ ...m, text: reply, ui: d.ui, streaming: false }));
          setChips(d.suggestions ?? []);
          setAnnounce(reply);
        }
      }
    } catch (e) {
      const message = (e as Error).message || 'Something went wrong. Please try again or text us.';
      patchLast((m) => ({ ...m, text: message, streaming: false, error: true }));
      setAnnounce(message);
    } finally { setBusy(false); setStatus(''); area.current?.focus(); }
  }, [busy, input, patchLast, pending]);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const room = MAX_PHOTOS - pending.length;
    for (const f of [...files].slice(0, Math.max(0, room))) {
      const id = nid();
      try {
        const { blob, thumb } = await prepPhoto(f);
        setPending((p) => [...p, { id, thumb, status: 'uploading' }]);
        try { const path = await uploadPhoto(blob); setPending((p) => p.map((x) => (x.id === id ? { ...x, path, status: 'ready' } : x))); }
        catch (e) { setPending((p) => p.map((x) => (x.id === id ? { ...x, status: 'error', error: (e as Error).message } : x))); }
      } catch (e) { setPending((p) => [...p, { id, thumb: '', status: 'error', error: (e as Error).message }]); }
    }
    if (file.current) file.current.value = '';
  }

  function newChat() { saveSaved(null); saved.current = null; setMsgs([{ id: 'greet', role: 'assistant', text: GREETING }]); setChips(START_CHIPS); setPending([]); setAnnounce('Started a new chat.'); area.current?.focus(); }

  const uploading = pending.some((p) => p.status === 'uploading');

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-end bg-black/60 sm:bg-transparent sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget && window.innerWidth >= 640) onClose(); }}>
      <div
        ref={root} role="dialog" aria-modal="true" aria-labelledby="cc-title"
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-graphite text-ivory shadow-2xl sm:h-[min(660px,calc(100dvh-2.5rem))] sm:w-[400px] sm:rounded-3xl sm:border sm:border-line"
      >
        <header className="flex items-center gap-3 border-b border-line bg-onyx px-4 py-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-full bg-gold text-onyx"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4z" /></svg></span>
          <div className="min-w-0 flex-1">
            <h2 id="cc-title" className="whitespace-nowrap font-display text-[0.72rem] uppercase tracking-[0.12em] text-ivory">916 Concierge</h2>
            <p className="truncate text-xs text-steel">AI booking assistant</p>
          </div>
          <button type="button" onClick={newChat} className="rounded-full px-3 py-2 text-xs text-steel hover:text-ivory">New chat</button>
          <button type="button" onClick={onClose} aria-label="Close chat" className="grid h-11 w-11 place-items-center rounded-full text-ivory hover:bg-graphite-2">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        <div ref={logEl} aria-live="off" role="log" aria-label="Conversation" tabIndex={0} className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
          {msgs.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'flex flex-col items-end' : 'flex flex-col items-start'}>
              {m.thumbs && m.thumbs.length > 0 && (
                <div className="mb-1 flex gap-1.5">{m.thumbs.map((t, i) => <img key={i} src={t} alt={`Photo ${i + 1} you sent`} width={64} height={64} className="h-16 w-16 rounded-xl object-cover" />)}</div>
              )}
              {(m.text || m.streaming) && (
                <p className={`max-w-[88%] whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl px-3.5 py-2.5 text-[0.93rem] leading-relaxed ${m.role === 'user' ? 'rounded-br-md bg-gold text-onyx' : m.error ? 'rounded-bl-md border border-[#7a3b36] bg-graphite-2 text-ivory' : 'rounded-bl-md bg-graphite-2 text-ivory'}`}>
                  {m.text || <span className="text-steel">Typing<span className="motion-safe:animate-pulse">…</span></span>}
                </p>
              )}
              {m.role === 'assistant' && m.ui && m.ui.length > 0 && (
                <div className="w-full max-w-[96%]"><Cards blocks={m.ui} onPick={(t) => void send(t)} onVerified={() => void send("I've verified my phone.")} /></div>
              )}
            </div>
          ))}
          {status && <p className="text-xs text-steel" role="status">{status}</p>}
        </div>

        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announce}</div>

        {chips.length > 0 && !busy && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-2" role="group" aria-label="Quick replies">
            {chips.map((c) => (
              <button key={c} type="button" onClick={() => (c === 'I will send photos' || c === 'Get a price from a photo' ? file.current?.click() : void send(c))} className="min-h-11 shrink-0 rounded-full border border-line px-3.5 text-[0.82rem] text-ivory transition-colors hover:border-gold hover:text-gold-light">{c}</button>
            ))}
          </div>
        )}

        {pending.length > 0 && (
          <ul className="flex gap-2 px-4 pb-2" aria-label="Photos to send">
            {pending.map((p) => (
              <li key={p.id} className="relative">
                {p.thumb ? <img src={p.thumb} alt="Photo to send" width={56} height={56} className={`h-14 w-14 rounded-xl object-cover ${p.status !== 'ready' ? 'opacity-50' : ''}`} /> : <span className="grid h-14 w-14 place-items-center rounded-xl border border-line text-xs text-steel">Error</span>}
                {p.status === 'uploading' && <span className="absolute inset-0 grid place-items-center text-[0.65rem] text-ivory" role="status">Adding…</span>}
                {p.status === 'error' && <span className="sr-only" role="alert">{p.error}</span>}
                <button type="button" aria-label="Remove photo" onClick={() => setPending((all) => all.filter((x) => x.id !== p.id))} className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-graphite-2 text-xs text-ivory ring-1 ring-line">×</button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="flex items-end gap-2 border-t border-line bg-onyx px-3 pt-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          onSubmit={(e) => { e.preventDefault(); void send(); }}
        >
          <input ref={file} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void addPhotos(e.target.files)} />
          <button type="button" aria-label="Add photos of the damage" onClick={() => file.current?.click()} disabled={pending.length >= MAX_PHOTOS} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line text-ivory hover:border-gold disabled:opacity-40">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-2h6l2 2h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></svg>
          </button>
          <label htmlFor="cc-input" className="sr-only">Message the 916 Concierge</label>
          <textarea
            id="cc-input" ref={area} rows={1} value={input} maxLength={MAX_CHARS} placeholder="Type a message"
            onChange={(e) => { setInput(e.target.value); e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 112)}px`; }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
            className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-graphite px-3.5 py-2.5 text-[16px] leading-snug text-ivory placeholder:text-steel"
          />
          <button type="submit" disabled={busy || uploading || (!input.trim() && !pending.some((p) => p.status === 'ready'))} aria-label="Send message" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold text-onyx transition-colors hover:bg-gold-light disabled:opacity-40">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </form>
        {input.length > MAX_CHARS - 100 && <p className="bg-onyx px-4 pb-2 text-right text-xs text-steel" aria-live="polite">{MAX_CHARS - input.length} characters left</p>}
      </div>
    </div>
  );
}
