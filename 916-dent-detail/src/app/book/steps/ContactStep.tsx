'use client';
import { useState } from 'react';
import { SMS_CONSENT_TEXT } from '@/config/booking';
import { captureAttribution } from '@/lib/attribution';
import { api } from '../api';
import { bookingFingerprint, emailOk, newKey, phoneOk, stepValid, type BookingRef } from '../state';
import { Field, NavButtons, StepFrame } from '../ui';
import type { StepProps } from './types';

type CreateResp = { bookingId: string; token: string; holdExpiresAt: string | null; payment: { mode: 'mock' | 'live'; clientSecret: string; intentId: string; amount: number; publishableKey?: string } };

export function ContactStep({ flow, dispatch, go, focusKey }: StepProps) {
  const c = flow.contact;
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const t = (k: string) => setTouched((s) => ({ ...s, [k]: true }));
  const set = (patch: Partial<typeof c>) => dispatch({ type: 'contact', patch });
  const e = {
    name: touched.name && c.name.trim().length < 2 ? 'Enter your name.' : undefined,
    phone: touched.phone && !phoneOk(c.phone) ? 'Enter a valid 10-digit US mobile number.' : undefined,
    email: touched.email && !emailOk(c.email) ? 'Enter a valid email address.' : undefined,
    addr: touched.addr && c.addressLine.trim().length < 4 ? 'Enter the street address where we will work.' : undefined,
  };

  async function reserve() {
    setTouched({ name: true, phone: true, email: true, addr: true });
    if (!stepValid(flow, 6) || !flow.slot) return;
    setErr(null);
    const fp = bookingFingerprint(flow);
    if (flow.booking && flow.booking.fingerprint === fp) return go(7);
    setBusy(true);
    // details changed after a hold was made: free the old hold first so we never block ourselves
    if (flow.booking) await api(`/api/booking/${flow.booking.token}`, { body: { action: 'release' } });
    const idemKey = newKey();
    const att = captureAttribution();
    const quoteId = flow.quote?.quoteId ?? undefined;
    const r = await api<CreateResp>('/api/booking', {
      headers: { 'Idempotency-Key': idemKey },
      body: {
        services: flow.services, addons: flow.addons, sizeClass: flow.sizeClass,
        vehicle: { year: Number(flow.year), make: flow.make.trim(), model: flow.model.trim() },
        photoPaths: flow.photos.map((p) => p.path), quoteId, zip: flow.zip, startsAt: flow.slot.startsAt, techId: flow.slot.techId,
        contact: { name: c.name.trim(), phone: c.phone.trim(), email: c.email.trim(), addressLine: c.addressLine.trim(), notes: c.notes.trim() || undefined, smsConsent: c.smsConsent, website: c.website },
        attribution: att.last, firstTouch: att.first,
      },
    });
    setBusy(false);
    if (!r.ok) {
      if (r.error.code === 'slot_unavailable') { dispatch({ type: 'patch', patch: { slot: null, booking: null } }); setErr(r.error.message); go(5); return; }
      setErr(r.error.message); return;
    }
    const ref: BookingRef = { id: r.data.bookingId, token: r.data.token, intentId: r.data.payment.intentId, mode: r.data.payment.mode, clientSecret: r.data.payment.clientSecret, publishableKey: r.data.payment.publishableKey, amount: r.data.payment.amount, holdExpiresAt: r.data.holdExpiresAt, fingerprint: fp };
    dispatch({ type: 'patch', patch: { booking: ref, idemKey } });
    go(7);
  }

  return (
    <StepFrame id="con" title="How do we reach you?" lede="We text and email your confirmation and reminders." focusKey={focusKey}>
      <form onSubmit={(ev) => { ev.preventDefault(); void reserve(); }} noValidate className="grid gap-5 sm:grid-cols-2">
        <Field id="c-name" label="Full name" error={e.name}>
          <input id="c-name" className="bk-input" autoComplete="name" value={c.name} onChange={(ev) => set({ name: ev.target.value })} onBlur={() => t('name')} aria-invalid={Boolean(e.name)} aria-describedby={e.name ? 'c-name-err' : undefined} required maxLength={80} />
        </Field>
        <Field id="c-phone" label="Mobile number" error={e.phone}>
          <input id="c-phone" className="bk-input" type="tel" inputMode="tel" autoComplete="tel" placeholder="(916) 555-0123" value={c.phone} onChange={(ev) => set({ phone: ev.target.value })} onBlur={() => t('phone')} aria-invalid={Boolean(e.phone)} aria-describedby={e.phone ? 'c-phone-err' : undefined} required />
        </Field>
        <div className="sm:col-span-2">
          <Field id="c-email" label="Email" error={e.email}>
            <input id="c-email" className="bk-input" type="email" inputMode="email" autoComplete="email" value={c.email} onChange={(ev) => set({ email: ev.target.value })} onBlur={() => t('email')} aria-invalid={Boolean(e.email)} aria-describedby={e.email ? 'c-email-err' : undefined} required maxLength={120} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field id="c-addr" label={`Street address in ${flow.area?.city ?? 'your area'} (${flow.zip})`} hint="Where the car will be parked. Only used to find you." error={e.addr}>
            <input id="c-addr" className="bk-input" autoComplete="street-address" value={c.addressLine} onChange={(ev) => set({ addressLine: ev.target.value })} onBlur={() => t('addr')} aria-invalid={Boolean(e.addr)} aria-describedby={e.addr ? 'c-addr-err' : 'c-addr-hint'} required maxLength={120} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field id="c-notes" label="Anything we should know? (optional)" hint="Gate code, parking spot, power or water access.">
            <textarea id="c-notes" className="bk-input min-h-[96px]" value={c.notes} onChange={(ev) => set({ notes: ev.target.value })} maxLength={500} aria-describedby="c-notes-hint" />
          </Field>
        </div>
        {/* honeypot: hidden from people and assistive tech; bots fill it */}
        <div aria-hidden="true" className="absolute left-[-9999px]"><label>Website<input tabIndex={-1} autoComplete="off" value={c.website} onChange={(ev) => set({ website: ev.target.value })} /></label></div>

        <div className="sm:col-span-2">
          <label className="bk-choice">
            <input type="checkbox" checked={c.smsConsent} onChange={(ev) => set({ smsConsent: ev.target.checked })} aria-describedby="sms-consent" />
            <span className="bk-card">
              <span className="bk-mark" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 7.5l3 3 6-7" /></svg></span>
              <span><span className="block font-semibold">Text me about my appointment</span><span id="sms-consent" className="mt-1 block text-sm text-steel">{SMS_CONSENT_TEXT}</span></span>
            </span>
          </label>
          <p className="bk-hint mt-3">Optional. Without it we email you only, and you can still book.</p>
        </div>
        {err && <p role="alert" className="bk-err sm:col-span-2">{err}</p>}
        <div className="sm:col-span-2"><NavButtons onBack={() => go(5)} onNext={() => void reserve()} nextLabel="Reserve my time" busy={busy} hint={undefined} /></div>
      </form>
    </StepFrame>
  );
}
