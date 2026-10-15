'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { track } from '@/lib/analytics';
import { getConsent } from '@/lib/analytics-consent';
import { api } from '../api';
import { site, smsHref, telHref } from '@/config/site';
import { serviceById } from '@/config/booking';
import { priceFor } from '../state';
import { ESTIMATE_LABEL } from '@/config/pricing';
import { formatRange } from '@/lib/pricing';
import { StepFrame } from '../ui';
import type { StepProps } from './types';

export function ConfirmStep({ flow, focusKey, token, onAnother }: StepProps & { token: string; onAnother: () => void }) {
  const fired = useRef(false);
  const price = priceFor(flow);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const eventId = track('booking_completed', { where: 'book_flow', services: flow.services.join(','), value: flow.booking?.amount ?? 0, city: flow.area?.city });
    // server-side twin (Meta CAPI): same event_id so Meta dedupes; the server refuses unless marketing consent is true
    const cookie = (n: string) => document.cookie.split('; ').find((c) => c.startsWith(`${n}=`))?.split('=')[1];
    if (typeof eventId === 'string') void api(`/api/booking/${token}`, { body: { action: 'capi', eventId, marketingConsent: getConsent().marketing, fbp: cookie('_fbp'), fbc: cookie('_fbc'), sourceUrl: window.location.origin + '/book' } });
  }, [flow, token]);
  return (
    <StepFrame id="done" title="You're booked" lede="Check your email and texts for the confirmation. We come to you." focusKey={focusKey}>
      <div className="card p-6">
        <p className="eyebrow mb-3">Appointment</p>
        <p className="font-display text-xl text-ivory">{flow.slot?.date} at {flow.slot?.label}</p>
        <p className="mt-2 text-steel">{flow.services.map((s) => serviceById(s)?.plain).join(' + ')} · {flow.year} {flow.make} {flow.model}</p>
        <p className="mt-1 text-steel">{flow.contact.addressLine}, {flow.area?.city} {flow.zip}</p>
        {price && price.ok && price.status === 'priced' && <p className="mt-4 text-sm text-steel">Estimated total {formatRange(price.totalLow!, price.totalHigh!)}. {ESTIMATE_LABEL}</p>}
        {flow.booking?.mode === 'mock' && <p className="bk-demo mt-4 text-sm"><strong>DEMO booking.</strong> No card was charged and no real messages were sent.</p>}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[['Reminders', 'We remind you the day before and two hours before.'], ['On the way', 'You get a text with an ETA when we leave.'], ['After the job', 'Your invoice arrives, and the deposit comes off the total.']].map(([t, b]) => (
          <div key={t} className="card p-5"><h3 className="text-sm">{t}</h3><p className="mt-2 text-sm text-steel">{b}</p></div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/booking/${token}`} className="btn btn-gold">Change or cancel</Link>
        <a href={telHref} className="btn btn-outline">Call {site.phone.display}</a>
        <a href={smsHref} className="btn btn-outline">Text us</a>
        <button type="button" className="btn btn-outline" onClick={onAnother}>Book another vehicle</button>
      </div>
    </StepFrame>
  );
}
