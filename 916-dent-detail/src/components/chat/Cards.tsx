'use client';
// Server-produced UI blocks. These come from tool results (never from model text), so a prompt-injected reply cannot
// forge a "pay here" card or a quote.
import { useState } from 'react';
import type { UiBlock } from '@/lib/concierge/types';
import { smsHref, telHref, site } from '@/config/site';

const money = (n: number) => `$${n.toLocaleString('en-US')}`;
const shortSlot = (l: string) => l.replace(/^(\w{3})\w*, (\w{3})\w* (\d+) at /, '$1 $2 $3 · ');
const card = 'mt-2 rounded-2xl border border-line bg-onyx/60 p-3 text-sm';

export function Cards({ blocks, onPick, onVerified }: { blocks: UiBlock[]; onPick: (text: string) => void; onVerified: () => void }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'slots':
            return (
              <div key={i} className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Open times">
                {b.slots.slice(0, 6).map((s) => (
                  <button key={s.id} type="button" onClick={() => onPick(`I'll take ${s.label}`)} className="min-h-11 rounded-full border border-gold/60 px-3.5 py-2 text-left text-[0.82rem] font-medium text-ivory transition-colors hover:border-gold-light hover:text-gold-light">
                    {shortSlot(s.label)}
                  </button>
                ))}
              </div>
            );
          case 'quote':
            return (
              <div key={i} className={card} role="group" aria-label="Estimate">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-gold">{b.services.join(' + ')}</p>
                <p className="mt-1 font-display text-lg text-ivory">{money(b.low)} to {money(b.high)}</p>
                {b.travelFee > 0 && <p className="text-steel">Plus a {money(b.travelFee)} travel fee.</p>}
                <p className="mt-1 text-steel">{b.label}</p>
                <p className="text-steel">A {money(b.deposit)} deposit holds your time and is credited to your final invoice.</p>
              </div>
            );
          case 'booking_hold':
            return (
              <div key={i} className={`${card} border-gold/50`} role="group" aria-label="Your held time">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-gold">Time held for {b.holdMinutes} minutes</p>
                <p className="mt-1 text-ivory">{b.services.join(' + ')}</p>
                <p className="text-ivory">{b.when}</p>
                {b.priceLow !== null && b.priceHigh !== null && <p className="text-steel">{money(b.priceLow)} to {money(b.priceHigh)}. {b.estimateLabel}</p>}
                <a href={b.depositUrl} className="btn btn-gold mt-3 w-full text-center" data-concierge-deposit>Pay {money(b.deposit)} deposit to lock it in</a>
                <p className="mt-2 text-xs text-steel">Secure checkout. Your time is confirmed once the deposit goes through.</p>
              </div>
            );
          case 'booking_list':
            return (
              <ul key={i} className={`${card} space-y-1`} aria-label="Your bookings">
                {b.bookings.map((x) => <li key={x.id} className="text-ivory">{x.services.join(' + ')} <span className="text-steel">· {x.when} · {x.status.replace(/_/g, ' ')}</span></li>)}
              </ul>
            );
          case 'verify_phone':
            return <VerifyForm key={i} hint={b.mockCodeHint} onVerified={onVerified} />;
          case 'handoff':
            return (
              <div key={i} className={card} role="group" aria-label="Owners notified">
                <p className="text-ivory">The owners have this conversation.</p>
                {!site.phone.placeholder && <p className="text-steel">Prefer to talk now? <a className="text-gold underline underline-offset-4" href={telHref}>Call</a> or <a className="text-gold underline underline-offset-4" href={smsHref}>text</a> us.</p>}
              </div>
            );
        }
      })}
    </>
  );
}

function VerifyForm({ hint, onVerified }: { hint?: string; onVerified: () => void }) {
  const [step, setStep] = useState<'phone' | 'code' | 'done'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const ids = { phone: 'cc-verify-phone', code: 'cc-verify-code' };

  async function call(body: Record<string, unknown>) {
    const s = (() => { try { return JSON.parse(localStorage.getItem('d916_concierge_v1') ?? 'null') as { conversationId: string; sessionToken: string } | null; } catch { return null; } })();
    if (!s) { setErr('Please send a message first.'); return null; }
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/concierge/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, conversationId: s.conversationId, sessionToken: s.sessionToken }) });
      const j = (await res.json()) as Record<string, unknown> & { error?: { message?: string } };
      if (!res.ok) { setErr(j.error?.message ?? 'Something went wrong.'); return null; }
      return j;
    } catch { setErr('Connection problem. Try again.'); return null; } finally { setBusy(false); }
  }

  if (step === 'done') return <p className={`${card} text-ivory`} role="status">Phone verified.</p>;
  return (
    <form
      className={`${card} space-y-2`}
      onSubmit={async (e) => {
        e.preventDefault();
        if (step === 'phone') { const j = await call({ action: 'start', phone }); if (j) setStep('code'); }
        else { const j = await call({ action: 'confirm', code }); if (j) { setStep('done'); onVerified(); } }
      }}
    >
      <p className="font-medium text-ivory">Verify your phone</p>
      {step === 'phone' ? (
        <>
          <label htmlFor={ids.phone} className="block text-xs text-steel">Mobile number. We text you a 6-digit code.</label>
          <input id={ids.phone} type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="min-h-11 w-full rounded-xl border border-line bg-graphite px-3 text-ivory placeholder:text-steel" placeholder="(916) 555-0123" />
        </>
      ) : (
        <>
          <label htmlFor={ids.code} className="block text-xs text-steel">Enter the code we sent.{hint ? ` Demo mode: the code is ${hint}.` : ''}</label>
          <input id={ids.code} inputMode="numeric" autoComplete="one-time-code" required maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="min-h-11 w-full rounded-xl border border-line bg-graphite px-3 tracking-[0.3em] text-ivory" />
        </>
      )}
      {err && <p role="alert" className="text-xs text-[#f2a39b]">{err}</p>}
      <button type="submit" disabled={busy} className="btn btn-gold min-h-11 w-full text-sm disabled:opacity-60">{busy ? 'One moment…' : step === 'phone' ? 'Text me a code' : 'Verify'}</button>
    </form>
  );
}
