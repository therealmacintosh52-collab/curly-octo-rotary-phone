'use client';
// The tech's job screen. Everything is optimistic and offline-tolerant: writes go through postJson (queued to
// localStorage when there is no signal, replayed with the same opId so nothing double-applies).
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { computeInvoice, type LineItem } from '@/lib/admin/invoice';
import { money } from '@/lib/admin/format';
import { appleMapsUrl, mapsUrl, smsUrl, telUrl, geoUrl } from '@/lib/admin/links';
import type { JobSnapshot } from '@/lib/admin/jobs';
import { newOpId, postJson } from '../outbox';
import { PhotoCapture, type PanelPhoto } from './PhotoCapture';
import { SignaturePad } from './SignaturePad';

export type PanelProps = {
  jobId: string; snapshot: JobSnapshot; depositApplied: number;
  customer: { name: string; phone: string | null; email: string | null; smsOk: boolean } | null;
  vehicle: string; address: string; services: string; customerNotes: string | null; estimate: string; needsReview: boolean; staff: boolean;
  addons: { id: string; label: string; price: number }[]; photos: PanelPhoto[]; quotePhotos: string[];
  notes: { id: string; body: string; at: string }[]; signaturePath: string | null; membership: { id: string; tier: string; balance: number } | null;
  methods: { id: string; label: string }[]; demo: boolean; terminal: boolean; etaGuess: number; liveStripe: boolean;
};

type Msg = { kind: 'ok' | 'err' | 'info'; text: string } | null;
const tone = (m: NonNullable<Msg>) => (m.kind === 'err' ? 'border-[#8a3b3b] bg-[#231212] text-[#f6b4b4]' : m.kind === 'ok' ? 'border-[#2f6b49] bg-[#0f2017] text-[#a6e8c0]' : 'border-[#35557a] bg-[#101a26] text-[#a9cbf2]');

export function JobPanel(p: PanelProps) {
  const router = useRouter();
  const [snap, setSnap] = useState<JobSnapshot>(p.snapshot);
  const [photos, setPhotos] = useState<PanelPhoto[]>(p.photos);
  const [notes, setNotes] = useState(p.notes);
  const [sig, setSig] = useState<string | null>(p.signaturePath);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState('');
  const [eta, setEta] = useState(String(p.etaGuess));
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(p.methods[0]?.id ?? 'cash');
  const [ref, setRef] = useState('');
  const [noteText, setNoteText] = useState('');
  const [cLabel, setCLabel] = useState('');
  const [cAmount, setCAmount] = useState('');
  const [memLeft, setMemLeft] = useState<number | null>(p.membership?.balance ?? null);
  const [payUrl, setPayUrl] = useState<{ url: string; mock: boolean } | null>(p.snapshot.payLink);

  const done = snap.status === 'completed';
  const started = snap.status === 'in_progress' || done;
  const math = snap.math;
  const shownAmount = amount === '' ? String(Math.max(0, math.balance)) : amount;

  async function act(label: string, body: Record<string, unknown>, offline: (s: JobSnapshot) => JobSnapshot, queueable = true) {
    setBusy(label); setMsg(null);
    const r = await postJson<{ snapshot?: JobSnapshot } & Record<string, unknown>>('/api/admin/tech/action', { jobId: p.jobId, ...body }, { label, queueable });
    setBusy('');
    if (!r.ok) { setMsg({ kind: 'err', text: r.message }); return null; }
    if (r.queued) { setSnap((s) => offline(s)); setMsg({ kind: 'info', text: 'Saved on this phone. It will sync when you are back online.' }); return null; }
    if (r.data.snapshot) setSnap(r.data.snapshot);
    return r.data;
  }

  const withLines = (s: JobSnapshot, lines: LineItem[]): JobSnapshot => {
    const m = computeInvoice(lines, p.depositApplied);
    return { ...s, lines, math: { ...m, paid: s.math.paid, balance: Math.round((m.total - s.math.paid) * 100) / 100 } };
  };

  const onMyWay = async () => { const d = await act('on_my_way', { action: 'on_my_way', etaMinutes: Number(eta) || undefined }, (s) => ({ ...s, status: 'on_the_way', etaMinutes: Number(eta) || null })); if (d) setMsg({ kind: 'ok', text: `On-the-way text sent (about ${String((d as { etaMinutes?: number }).etaMinutes ?? eta)} min).` }); };
  const start = async () => { const d = await act('start', { action: 'start' }, (s) => ({ ...s, status: 'in_progress', startedAt: new Date().toISOString() })); if (d) setMsg({ kind: 'ok', text: 'Job started. Timer is running.' }); };
  const addAddon = (a: { id: string; label: string; price: number }) => { const lineId = newOpId(); void act(`addon-${a.id}`, { action: 'add_addon', lineId, addonId: a.id }, (s) => withLines(s, [...s.lines, { id: lineId, label: a.label, amount: a.price, qty: 1, kind: 'addon', addonId: a.id }])); };
  const addCustom = () => {
    const amt = Number(cAmount); if (!cLabel.trim() || !Number.isFinite(amt) || amt === 0) { setMsg({ kind: 'err', text: 'Enter a label and an amount.' }); return; }
    const lineId = newOpId();
    void act('custom', { action: 'add_custom', lineId, label: cLabel.trim(), amount: amt, kind: 'custom' }, (s) => withLines(s, [...s.lines, { id: lineId, label: cLabel.trim(), amount: amt, qty: 1, kind: 'custom' }]));
    setCLabel(''); setCAmount('');
  };
  const removeLine = (l: LineItem) => void act('remove', { action: 'remove_line', lineId: l.id }, (s) => withLines(s, s.lines.filter((x) => x.id !== l.id)));
  const setLineAmount = (l: LineItem, v: string) => { const n = Number(v); if (Number.isFinite(n) && n >= 0 && n !== l.amount) void act('amount', { action: 'set_amount', lineId: l.id, amount: n }, (s) => withLines(s, s.lines.map((x) => (x.id === l.id ? { ...x, amount: n } : x)))); };

  const pay = async () => {
    const amt = Number(shownAmount); if (!(amt > 0)) { setMsg({ kind: 'err', text: 'Enter an amount.' }); return; }
    const opId = newOpId();
    const d = await act('pay', { action: 'pay', amount: amt, method, reference: ref || undefined, opId }, (s) => ({ ...s, math: { ...s.math, paid: s.math.paid + amt, balance: Math.round((s.math.balance - amt) * 100) / 100 } }));
    if (d) { setMsg({ kind: 'ok', text: `${money(amt)} recorded.` }); setAmount(''); setRef(''); }
  };
  const payLink = async () => { const d = await act('pay_link', { action: 'pay_link' }, (s) => s, false); if (d) { const x = d as { url: string; mock: boolean }; setPayUrl({ url: x.url, mock: x.mock }); setMsg({ kind: 'ok', text: x.mock ? 'DEMO pay link created.' : 'Pay link ready. Text it or show the customer.' }); } };
  const demoPay = async () => { const d = await act('demo_pay', { action: 'demo_pay' }, (s) => s, false); if (d) setMsg({ kind: 'ok', text: 'DEMO payment recorded.' }); };
  const checkLink = async () => { const d = await act('pay_link_check', { action: 'pay_link_check' }, (s) => s, false); setMsg((d as { paid?: boolean } | null)?.paid ? { kind: 'ok', text: 'Paid. Thank you!' } : { kind: 'info', text: 'Not paid yet.' }); };
  const useVisit = async () => { if (!p.membership) return; const d = await act('use_visit', { action: 'use_visit', membershipId: p.membership.id }, (s) => s, false); if (d) { setMemLeft((d as { left: number }).left); setMsg({ kind: 'ok', text: 'Membership visit used.' }); } };

  const addNote = async () => {
    const body = noteText.trim(); if (!body) return;
    const noteId = crypto.randomUUID();
    setNotes((n) => [{ id: noteId, body, at: new Date().toISOString() }, ...n]); setNoteText('');
    const r = await postJson('/api/admin/tech/action', { jobId: p.jobId, action: 'note', noteId, body }, { label: 'note', queueable: true });
    if (!r.ok) { setNotes((n) => n.filter((x) => x.id !== noteId)); setMsg({ kind: 'err', text: r.message }); }
    else if (r.queued) setMsg({ kind: 'info', text: 'Note saved on this phone. It will sync when you are back online.' });
  };

  const finish = async () => {
    if (math.subtotal <= 0) { setMsg({ kind: 'err', text: 'Add the final price first (dent work has no fixed price until you set it).' }); return; }
    if (math.balance > 0 && !window.confirm(`${money(math.balance)} is still unpaid. Finish anyway? An invoice will be sent.`)) return;
    const d = await act('finish', { action: 'finish' }, (s) => ({ ...s, status: 'completed', finishedAt: new Date().toISOString() }));
    if (d) { setMsg({ kind: 'ok', text: `Job finished. Invoice ${(d as { number?: string }).number ?? ''} created and the review request is scheduled.`.replace('  ', ' ') }); router.refresh(); }
  };

  const saveSignature = async (dataUrl: string): Promise<string | null> => {
    const r = await postJson<{ ok: boolean }>('/api/admin/tech/signature', { jobId: p.jobId, dataUrl }, { label: 'signature', queueable: false });
    if (!r.ok) return r.message;
    setSig('saved'); return null;
  };

  const addr = p.address;
  const btn = 'adm-btn adm-btn-big w-full';
  return (
    <div className="space-y-4 px-4 pb-6">
      {msg && <p role={msg.kind === 'err' ? 'alert' : 'status'} className={`rounded-xl border px-3 py-2 text-sm ${tone(msg)}`}>{msg.text}</p>}

      <section aria-labelledby="who-h" className="adm-card p-4 space-y-3">
        <h2 id="who-h" className="text-lg font-semibold">{p.customer?.name ?? 'Customer'}</h2>
        <p className="text-sm text-[#d6d8dd]">{p.services}{p.vehicle ? ` · ${p.vehicle}` : ''}</p>
        <p className="text-sm text-[#a9acb3]">{addr || 'No address'} {p.estimate && <span> · Est. {p.estimate}</span>}</p>
        {p.needsReview && <p className="text-sm text-gold-light">Dent price not set yet: review the photos and add the price below.</p>}
        {p.customerNotes && <p className="whitespace-pre-wrap rounded-xl bg-[#101113] px-3 py-2 text-sm">{p.customerNotes}</p>}
        <div className="grid grid-cols-2 gap-2">
          {addr && <a className="adm-btn adm-btn-gold" href={mapsUrl(addr)}>Navigate</a>}
          {p.customer?.phone && <a className="adm-btn adm-btn-line" href={telUrl(p.customer.phone)}>Call</a>}
          {p.customer?.phone && <a className="adm-btn adm-btn-line" href={smsUrl(p.customer.phone)}>Text</a>}
          {addr && <a className="adm-btn adm-btn-line" href={appleMapsUrl(addr)}>Apple Maps</a>}
        </div>
        {addr && <p className="text-xs text-[#8c8f96]">Android map apps: <a className="underline" href={geoUrl(addr)}>open with geo link</a></p>}
      </section>

      {!done && (
        <section aria-labelledby="status-h" className="adm-card p-4 space-y-3">
          <h2 id="status-h" className="text-base font-semibold">Job status: <span data-testid="job-status" className="text-gold-light">{snap.status.replace('_', ' ')}</span></h2>
          {snap.status === 'confirmed' && (
            <div className="space-y-2">
              <label htmlFor="eta" className="adm-label">Minutes until you arrive</label>
              <input id="eta" type="number" inputMode="numeric" min={1} max={240} value={eta} onChange={(e) => setEta(e.target.value)} className="adm-input" />
              <button type="button" className={`${btn} adm-btn-line`} onClick={onMyWay} disabled={!!busy}>{busy === 'on_my_way' ? 'Sending…' : 'On my way (text the customer)'}</button>
            </div>
          )}
          {(snap.status === 'confirmed' || snap.status === 'on_the_way') && <button type="button" className={`${btn} adm-btn-gold`} onClick={start} disabled={!!busy}>{busy === 'start' ? 'Starting…' : 'Start job'}</button>}
          {snap.status === 'on_the_way' && <p className="text-sm text-[#a9cbf2]">Customer was told you are about {snap.etaMinutes ?? eta} minutes away.</p>}
          {started && snap.startedAt && <p className="text-sm text-[#a9acb3]">Started {new Date(snap.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })}</p>}
        </section>
      )}

      <section aria-labelledby="photos-h" className="adm-card p-4 space-y-5">
        <h2 id="photos-h" className="text-base font-semibold">Photos</h2>
        {p.quotePhotos.length > 0 && (
          <div><p className="mb-2 text-sm text-[#a9acb3]">From the customer</p><ul className="grid grid-cols-4 gap-2">{p.quotePhotos.map((q) => (
            // eslint-disable-next-line @next/next/no-img-element
            <li key={q}><img src={`/api/admin/photo?path=${encodeURIComponent(q)}`} alt="Customer-submitted photo" className="aspect-square w-full rounded-lg object-cover" loading="lazy" /></li>))}</ul></div>
        )}
        <PhotoCapture jobId={p.jobId} kind="before" photos={photos} onAdded={(x) => setPhotos((a) => [...a, x])} onConsent={(id, v) => setPhotos((a) => a.map((x) => (x.id === id ? { ...x, consent: v } : x)))} />
        <PhotoCapture jobId={p.jobId} kind="after" photos={photos} onAdded={(x) => setPhotos((a) => [...a, x])} onConsent={(id, v) => setPhotos((a) => a.map((x) => (x.id === id ? { ...x, consent: v } : x)))} />
      </section>

      <section aria-labelledby="lines-h" className="adm-card p-4 space-y-3">
        <h2 id="lines-h" className="text-base font-semibold">Work and price</h2>
        {snap.lines.length === 0 && <p className="text-sm text-[#a9acb3]">No price yet. Add the work below.</p>}
        <ul className="divide-y divide-line">
          {snap.lines.map((l) => (
            <li key={l.id} className="flex min-h-14 items-center gap-2 py-1">
              <span className="min-w-0 flex-1 text-sm">{l.label}{l.kind === 'addon' && <span className="ml-1 text-xs text-gold-light">add-on</span>}</span>
              {!done && l.amount >= 0 && !l.id.startsWith('ref') ? (
                <>
                  <label htmlFor={`amt-${l.id}`} className="sr-only">Amount for {l.label}</label>
                  <input id={`amt-${l.id}`} type="number" inputMode="decimal" step="1" min={0} defaultValue={l.amount} className="adm-input !min-h-11 !w-24 text-right" onBlur={(e) => setLineAmount(l, e.target.value)} />
                  <button type="button" className="adm-btn adm-btn-line !min-h-11 !px-3" aria-label={`Remove ${l.label}`} onClick={() => removeLine(l)}>×</button>
                </>
              ) : <span className="tabular-nums">{money(l.amount)}</span>}
            </li>
          ))}
        </ul>
        {!done && p.addons.length > 0 && (
          <div><p className="mb-2 text-sm font-semibold">Offer an add-on</p>
            <div className="flex flex-wrap gap-2">{p.addons.map((a) => {
              const has = snap.lines.some((l) => l.addonId === a.id);
              return <button key={a.id} type="button" disabled={has || !!busy} onClick={() => addAddon(a)} className="adm-btn adm-btn-line !min-h-12">{has ? '✓ ' : '+ '}{a.label} {money(a.price)}</button>;
            })}</div></div>
        )}
        {!done && (
          <div className="grid grid-cols-[1fr_6rem_auto] items-end gap-2">
            <div><label htmlFor="cl" className="adm-label">Other work</label><input id="cl" value={cLabel} onChange={(e) => setCLabel(e.target.value)} className="adm-input" placeholder="e.g. Door ding, rear bumper" /></div>
            <div><label htmlFor="ca" className="adm-label">Price $</label><input id="ca" type="number" inputMode="decimal" step="1" value={cAmount} onChange={(e) => setCAmount(e.target.value)} className="adm-input" /></div>
            <button type="button" className="adm-btn adm-btn-line" onClick={addCustom} disabled={!!busy}>Add</button>
          </div>
        )}
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-line pt-3 text-sm">
          <dt className="text-[#a9acb3]">Job total</dt><dd className="text-right tabular-nums" data-testid="subtotal">{money(math.subtotal)}</dd>
          <dt className="text-[#a9acb3]">Deposit paid</dt><dd className="text-right tabular-nums">−{money(math.depositApplied)}</dd>
          <dt className="text-[#a9acb3]">Paid today</dt><dd className="text-right tabular-nums">{money(math.paid)}</dd>
          <dt className="font-semibold">Balance due</dt><dd className="text-right text-lg font-semibold tabular-nums text-gold-light" data-testid="balance">{money(math.balance)}</dd>
        </dl>
      </section>

      <section aria-labelledby="pay-h" className="adm-card p-4 space-y-3">
        <h2 id="pay-h" className="text-base font-semibold">Take payment</h2>
        {math.balance <= 0 && math.subtotal > 0 ? <p className="text-sm text-[#8fe0b0]" data-testid="paid-full">Paid in full.</p> : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="pay-amt" className="adm-label">Amount $</label><input id="pay-amt" type="number" inputMode="decimal" step="0.01" min="0.01" value={shownAmount} onChange={(e) => setAmount(e.target.value)} className="adm-input" /></div>
              <div><label htmlFor="pay-method" className="adm-label">How</label><select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)} className="adm-input">{p.methods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>
            </div>
            <div><label htmlFor="pay-ref" className="adm-label">Reference (optional)</label><input id="pay-ref" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={80} className="adm-input" placeholder="Zelle confirmation, check #" /></div>
            <button type="button" className={`${btn} adm-btn-gold`} onClick={pay} disabled={!!busy || math.subtotal <= 0}>{busy === 'pay' ? 'Recording…' : 'Record payment'}</button>
            <button type="button" className={`${btn} adm-btn-line`} onClick={payLink} disabled={!!busy || math.subtotal <= 0}>{payUrl ? 'Refresh pay link' : p.liveStripe ? 'Get a card pay link' : 'Get a pay link (demo)'}</button>
            {payUrl && (
              <div className="rounded-xl border border-line bg-[#101113] p-3 space-y-2">
                <p className="text-xs text-[#a9acb3]">{payUrl.mock ? 'DEMO link (not a real payment page):' : 'Send or show this link:'}</p>
                <p className="break-all text-sm" data-testid="pay-url">{payUrl.url}</p>
                <div className="flex flex-wrap gap-2">
                  {p.customer?.phone && !payUrl.mock && <a className="adm-btn adm-btn-line" href={smsUrl(p.customer.phone, `Pay your 916 Dent & Detail balance: ${payUrl.url}`)}>Text it</a>}
                  {payUrl.mock ? <button type="button" className="adm-btn adm-btn-line" onClick={demoPay} disabled={!!busy}>DEMO: mark link as paid</button> : <button type="button" className="adm-btn adm-btn-line" onClick={checkLink} disabled={!!busy}>Check if paid</button>}
                </div>
              </div>
            )}
            {p.terminal && <p className="text-xs text-[#a9acb3]">Card reader: server side is ready, but the reader screen is not built in this version. Use a pay link.</p>}
          </>
        )}
        {p.membership && memLeft !== null && (
          <div className="rounded-xl border border-[#6d5622] bg-[#1f1a0e] p-3 text-sm">
            <p className="text-gold-light">{p.membership.tier} member · {memLeft} visit credit{memLeft === 1 ? '' : 's'} left</p>
            {!done && memLeft >= 1 && <button type="button" className="adm-btn adm-btn-line mt-2" onClick={useVisit} disabled={!!busy}>Use a membership visit for this job</button>}
          </div>
        )}
      </section>

      <section aria-labelledby="sig-h" className="adm-card p-4 space-y-3">
        <h2 id="sig-h" className="text-base font-semibold">Customer signature <span className="text-sm font-normal text-[#a9acb3]">(optional)</span></h2>
        {sig ? (
          <div className="space-y-2">
            {sig !== 'saved' && /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/api/admin/photo?path=${encodeURIComponent(sig)}`} alt="Saved customer signature" className="h-28 w-full rounded-xl bg-white object-contain" />}
            <p className="text-sm text-[#8fe0b0]" data-testid="sig-saved">Signature saved.</p>
            {!done && <button type="button" className="adm-btn adm-btn-line" onClick={() => setSig(null)}>Sign again</button>}
          </div>
        ) : <SignaturePad onSave={saveSignature} disabled={done} />}
      </section>

      <section aria-labelledby="notes-h" className="adm-card p-4 space-y-3">
        <h2 id="notes-h" className="text-base font-semibold">Notes</h2>
        <div><label htmlFor="job-note" className="adm-label">Add a note</label><textarea id="job-note" value={noteText} onChange={(e) => setNoteText(e.target.value)} className="adm-input" maxLength={2000} /></div>
        <button type="button" className="adm-btn adm-btn-line w-full" onClick={addNote} disabled={!noteText.trim()}>Save note</button>
        <ul className="space-y-2">{notes.map((n) => <li key={n.id} className="rounded-xl bg-[#101113] px-3 py-2 text-sm"><p className="whitespace-pre-wrap">{n.body}</p></li>)}</ul>
      </section>

      {!done ? (
        <button type="button" className={`${btn} adm-btn-gold`} onClick={finish} disabled={!!busy} data-testid="finish">{busy === 'finish' ? 'Finishing…' : 'Finish job and send invoice'}</button>
      ) : (
        <section className="adm-card p-4 space-y-2" aria-live="polite">
          <h2 className="text-base font-semibold text-[#8fe0b0]">Job finished</h2>
          {snap.invoice && <p className="text-sm">Invoice <span data-testid="invoice-number">{snap.invoice.number}</span> · {snap.invoice.status}</p>}
          <p className="text-sm text-[#a9acb3]">The invoice and Google review request go out 2 hours after you finish.</p>
          {p.staff && snap.invoice && <a className="adm-btn adm-btn-line" href={`/admin/invoices/${snap.invoice.id}`}>Open invoice</a>}
        </section>
      )}
    </div>
  );
}
