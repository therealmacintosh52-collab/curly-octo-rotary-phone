'use client';
import { useState } from 'react';
import { getAttribution } from '@/lib/attribution';
import { track } from '@/lib/analytics';
import { postJson } from './api';
import { Field } from './Field';

export function SheetForm() {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [err, setErr] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? '').trim();
    if (s('name').length < 2 || s('company').length < 2 || !/^\S+@\S+\.\S+$/.test(s('email'))) { setErr('Add your name, company and a valid email.'); return; }
    setState('busy'); setErr('');
    const r = await postJson('/api/dealers/sheet-request', { name: s('name'), company: s('company'), email: s('email'), phone: s('phone') || undefined, message: s('message') || undefined, website: s('website'), attribution: getAttribution().last });
    if (!r.ok) { setState('idle'); setErr(r.message); return; }
    track('quote_requested', { where: 'dealer_sheet', step: 'submitted' });
    setState('done');
  }

  if (state === 'done') {
    return (
      <div role="status" className="rounded-2xl border border-[#2f6b49] bg-[#0f2017] p-5 text-[#cdeedb]">
        <p className="font-semibold">Got it. We will email you the wholesale sheet.</p>
        <p className="mt-1 text-sm">Rates are set by the owners, so a person sends the sheet rather than an automatic reply.</p>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {err && <p role="alert" className="rounded-2xl border border-[#8a3b3b] bg-[#231212] p-3 text-sm text-[#f4b0a5]">{err}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="sh-name" label="Your name" required>{(p) => <input {...p} name="name" className="dl-input" autoComplete="name" maxLength={80} />}</Field>
        <Field id="sh-company" label="Dealership or company" required>{(p) => <input {...p} name="company" className="dl-input" autoComplete="organization" maxLength={120} />}</Field>
        <Field id="sh-email" label="Email" required>{(p) => <input {...p} name="email" type="email" className="dl-input" autoComplete="email" maxLength={120} />}</Field>
        <Field id="sh-phone" label="Phone">{(p) => <input {...p} name="phone" type="tel" inputMode="tel" className="dl-input" autoComplete="tel" maxLength={30} />}</Field>
      </div>
      <Field id="sh-msg" label="Anything we should know?" hint="For example: how many cars a month, or which lot.">{(p) => <textarea {...p} name="message" className="dl-input" maxLength={500} rows={3} />}</Field>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <button type="submit" disabled={state === 'busy'} className="dl-btn dl-btn-gold w-full sm:w-fit">{state === 'busy' ? 'Sending…' : 'Request the wholesale sheet'}</button>
      <p className="dl-hint">We use this only to send the sheet and answer you. No marketing list.</p>
    </form>
  );
}
