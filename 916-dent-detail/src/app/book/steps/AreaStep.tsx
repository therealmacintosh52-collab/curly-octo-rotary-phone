'use client';
import { useState } from 'react';
import { SMS_CONSENT_TEXT } from '@/config/booking';
import { site, smsHref, telHref } from '@/config/site';
import { formatRange } from '@/lib/pricing';
import type { AreaResult } from '@/lib/geo';
import { captureAttribution } from '@/lib/attribution';
import { api } from '../api';
import { emailOk, phoneOk, stepValid } from '../state';
import { Field, NavButtons, Spinner, StepFrame } from '../ui';
import type { StepProps } from './types';

export function AreaStep({ flow, dispatch, go, focusKey }: StepProps) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lead, setLead] = useState({ name: '', phone: '', email: '', consent: false, website: '' });
  const [leadState, setLeadState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [leadErr, setLeadErr] = useState<string | null>(null);
  const area = flow.area && flow.area.zip === flow.zip ? flow.area : null;

  async function check() {
    setErr(null);
    if (!/^\d{5}$/.test(flow.zip)) { setErr('Enter a 5-digit ZIP code.'); return; }
    setBusy(true);
    const r = await api<AreaResult>(`/api/geo/zip?zip=${flow.zip}`);
    setBusy(false);
    if (!r.ok) { setErr(r.error.message); return; }
    dispatch({ type: 'patch', patch: { area: r.data, slot: null } });
  }

  async function sendLead() {
    setLeadErr(null);
    if (lead.name.trim().length < 2) return setLeadErr('Enter your name.');
    if (!phoneOk(lead.phone) && !emailOk(lead.email)) return setLeadErr('Enter a phone number or an email so we can reply.');
    setLeadState('sending');
    const r = await api('/api/lead', { body: { name: lead.name, phone: lead.phone || undefined, email: lead.email || undefined, zip: flow.zip, services: flow.services, smsConsent: lead.consent, website: lead.website, attribution: captureAttribution().last } });
    if (!r.ok) { setLeadState('idle'); return setLeadErr(r.error.message); }
    setLeadState('sent');
  }

  const unbookable = area && (area.status === 'out_of_area' || area.status === 'needs_review');
  return (
    <StepFrame id="area" title="Where will the car be?" lede="We come to your home, office or lot. Enter the ZIP where the vehicle will be parked." focusKey={focusKey}>
      <form onSubmit={(e) => { e.preventDefault(); void check(); }} noValidate>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:w-56">
            <Field id="zip" label="ZIP code" error={err ?? undefined}>
              <input id="zip" className="bk-input" inputMode="numeric" autoComplete="postal-code" maxLength={5} placeholder="95624" value={flow.zip} onChange={(e) => dispatch({ type: 'patch', patch: { zip: e.target.value.replace(/\D/g, '').slice(0, 5), slot: null } })} aria-invalid={Boolean(err)} aria-describedby={err ? 'zip-err' : undefined} />
            </Field>
          </div>
          <button type="submit" className="btn btn-gold" disabled={busy}>{busy ? <Spinner label="Checking…" /> : 'Check my area'}</button>
        </div>
      </form>

      <div aria-live="polite" className="mt-6">
        {area?.status === 'in_area' && (
          <div className="card p-5">
            <p className="font-semibold text-ivory">{area.message}</p>
            <p className="mt-2 text-sm text-steel">{area.travelFee ? <>Travel fee: <span className="text-ivory">{formatRange(area.travelFee, area.travelFee)}</span> for about {area.miles} miles from our base.</> : <>About {area.miles} miles from our base.</>}</p>
          </div>
        )}
        {area?.status === 'invalid' && <p role="alert" className="bk-err">{area.message}</p>}
        {unbookable && (
          <div className="card p-5">
            <p className="font-semibold text-ivory">{area!.message}</p>
            <p className="mt-2 text-sm text-steel">Leave your details and we will reply personally, or <a className="text-gold underline" href={smsHref}>text</a> or <a className="text-gold underline" href={telHref}>call {site.phone.display}</a>.</p>
            {leadState === 'sent' ? <p role="status" className="mt-4 text-gold">Thanks. We will be in touch soon.</p> : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field id="l-name" label="Name"><input id="l-name" className="bk-input" autoComplete="name" value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} /></Field>
                <Field id="l-phone" label="Mobile number"><input id="l-phone" className="bk-input" type="tel" autoComplete="tel" inputMode="tel" value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} /></Field>
                <div className="sm:col-span-2"><Field id="l-email" label="Email"><input id="l-email" className="bk-input" type="email" autoComplete="email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} /></Field></div>
                <div aria-hidden="true" className="absolute left-[-9999px]"><label>Website<input tabIndex={-1} autoComplete="off" value={lead.website} onChange={(e) => setLead({ ...lead, website: e.target.value })} /></label></div>
                <label className="flex items-start gap-3 text-sm text-steel sm:col-span-2">
                  <input type="checkbox" className="mt-1 h-5 w-5 accent-[#c9a24a]" checked={lead.consent} onChange={(e) => setLead({ ...lead, consent: e.target.checked })} />
                  <span>{SMS_CONSENT_TEXT}</span>
                </label>
                {leadErr && <p role="alert" className="bk-err sm:col-span-2">{leadErr}</p>}
                <div className="sm:col-span-2"><button type="button" className="btn btn-gold" onClick={() => void sendLead()} disabled={leadState === 'sending'}>{leadState === 'sending' ? <Spinner label="Sending…" /> : 'Ask if you can reach me'}</button></div>
              </div>
            )}
          </div>
        )}
      </div>
      <NavButtons onBack={() => go(3)} onNext={() => go(5)} nextDisabled={!stepValid(flow, 4)} hint={!area ? 'Check your ZIP to continue.' : unbookable ? 'We cannot book this ZIP online yet.' : undefined} />
    </StepFrame>
  );
}
