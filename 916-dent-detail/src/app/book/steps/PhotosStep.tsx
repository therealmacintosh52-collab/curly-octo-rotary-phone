'use client';
import { useEffect, useRef, useState } from 'react';
import { bookingConfig } from '@/config/booking';
import { ESTIMATE_LABEL } from '@/config/pricing';
import { track } from '@/lib/analytics';
import { formatRange, hasDent } from '@/lib/pricing';
import { api } from '../api';
import { prepPhoto } from '../image';
import { photoFingerprint, photosOk, needsPhotos, priceFor, type Photo, type QuoteOk, type QuoteNone } from '../state';
import { NavButtons, Spinner, StepFrame } from '../ui';
import type { StepProps } from './types';

type QuoteResp = { kind: 'ai' | 'config'; quote: (QuoteOk | QuoteNone) | null; quoteId: string | null };

export function PhotosStep({ flow, dispatch, go, focusKey }: StepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const required = needsPhotos(flow);
  const dent = hasDent(flow.services);
  const fp = photoFingerprint(flow);
  const have = flow.photos.length;
  const min = bookingConfig.photos.minForDents;

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setErr(null); setBusy(true);
    const added: Photo[] = [];
    for (const file of Array.from(files)) {
      if (have + added.length >= bookingConfig.photos.max) { setErr(`You can add up to ${bookingConfig.photos.max} photos.`); break; }
      try {
        const { blob, thumb } = await prepPhoto(file);
        const form = new FormData(); form.append('file', blob, 'photo.jpg');
        const res = await fetch('/api/photos', { method: 'POST', body: form });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) { setErr(j?.error?.message ?? 'Upload failed. Please try again.'); continue; }
        added.push({ path: j.path, name: file.name.slice(0, 40), thumb });
      } catch (e) { setErr((e as Error).message); }
    }
    if (added.length) {
      dispatch({ type: 'patch', patch: { photos: [...flow.photos, ...added], quote: null, slot: null } });
      setAnnounce(`${added.length} photo${added.length > 1 ? 's' : ''} added.`);
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  }
  function remove(path: string) {
    dispatch({ type: 'patch', patch: { photos: flow.photos.filter((p) => p.path !== path), quote: null, slot: null } });
    setAnnounce('Photo removed.');
  }

  async function getEstimate() {
    setQuoting(true); setErr(null);
    track('quote_requested', { where: 'book_flow', services: flow.services.join(','), photos: have });
    const r = await api<QuoteResp>('/api/quote', { body: { services: flow.services, addons: flow.addons, sizeClass: flow.sizeClass, vehicle: { year: Number(flow.year), make: flow.make, model: flow.model }, photoPaths: flow.photos.map((p) => p.path) } });
    setQuoting(false);
    if (!r.ok) { setErr(r.error.message); return; }
    if (r.data.quote) dispatch({ type: 'patch', patch: { quote: { quoteId: r.data.quoteId, result: r.data.quote, fingerprint: fp } } });
  }

  // fetch once automatically when the photo requirement is satisfied and there is no fresh quote
  const stale = !flow.quote || flow.quote.fingerprint !== fp;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starts a network request that reports its state
    if (dent && photosOk(flow) && stale && !quoting && !busy && !err) void getEstimate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dent, have, stale]);

  const q = flow.quote && flow.quote.fingerprint === fp ? flow.quote.result : null;
  const price = priceFor(flow);
  const canContinue = photosOk(flow) && !busy && !quoting && (!dent || q !== null);
  const hint = busy ? 'Uploading photos…' : quoting ? 'Reading your photos…' : required && !photosOk(flow) ? `Add at least ${min} photos to continue (${have}/${min}).` : undefined;

  return (
    <StepFrame id="pho" title={required ? 'Add photos of the damage' : 'Add photos (optional)'} lede={required ? `Dent price comes from your photos. Add at least ${min}: one wide shot of the panel and a close-up of each dent. Natural light, no flash.` : 'Photos are optional for detailing. They help us bring the right products.'} focusKey={focusKey}>
      <div className="card p-5">
        <input ref={inputRef} id="photo-input" type="file" accept="image/*" multiple className="sr-only" onChange={(e) => void onFiles(e.target.files)} disabled={busy || have >= bookingConfig.photos.max} />
        <label htmlFor="photo-input" className={`btn btn-gold w-full cursor-pointer sm:w-auto ${busy || have >= bookingConfig.photos.max ? 'opacity-50' : ''}`}>
          {busy ? <Spinner label="Uploading…" /> : have ? 'Add more photos' : 'Take or choose photos'}
        </label>
        <p className="bk-hint mt-3">Up to {bookingConfig.photos.max} photos. We shrink them on your phone before upload.</p>
        <p className="sr-only" role="status">{announce}</p>

        {have > 0 && (
          <ul className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4" aria-label="Your photos">
            {flow.photos.map((p, i) => (
              <li key={p.path} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-graphite-2">
                {/* thumbnail is a small data URL made in the browser; alt text names the photo */}
                {p.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumb} alt={`Photo ${i + 1}: ${p.name}`} className="h-full w-full object-cover" />
                ) : <span className="grid h-full place-items-center px-2 text-center text-xs text-steel">Photo {i + 1}</span>}
                <button type="button" onClick={() => remove(p.path)} className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-full bg-onyx/85 text-ivory" aria-label={`Remove photo ${i + 1}`}>
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8" /></svg>
                </button>
              </li>
            ))}
          </ul>
        )}
        {err && <p role="alert" className="bk-err mt-4">{err}</p>}
      </div>

      {dent && (
        <div className="card mt-6 p-5" aria-live="polite">
          <p className="eyebrow mb-3">Photo estimate</p>
          {quoting && <Spinner label="Reading your photos…" />}
          {!quoting && !q && <p className="text-steel">{photosOk(flow) ? 'One moment…' : 'Your estimate appears here once you add photos.'}</p>}
          {!quoting && q?.status === 'ok' && (
            <>
              <p className="font-display text-2xl text-ivory">{formatRange(q.low, q.high)}</p>
              <p className="mt-1 text-sm text-steel">{q.confidenceLabel === 'high' ? 'Confident' : q.confidenceLabel === 'medium' ? 'Fairly confident' : 'Low confidence, so the range is wider'} · about {q.panelCount} panel{q.panelCount > 1 ? 's' : ''}</p>
              {q.notes && <p className="mt-3 text-sm">{q.notes}</p>}
              <p className="mt-3 text-sm text-steel">{ESTIMATE_LABEL}</p>
              {q.mock && <p className="bk-demo mt-3 text-sm"><strong>DEMO estimate.</strong> No AI key is configured, so this range is generated from fixed rules.</p>}
              {price && price.ok && price.status === 'priced' && flow.services.length > 1 && <p className="mt-3 text-sm text-steel">All services together: {formatRange(price.low!, price.high!)}</p>}
            </>
          )}
          {!quoting && q && q.status !== 'ok' && (
            <>
              <p>{q.message}</p>
              <button type="button" className="btn btn-outline mt-4" onClick={() => void getEstimate()}>Try again</button>
            </>
          )}
        </div>
      )}
      {!dent && <p className="mt-6 text-sm text-steel">{ESTIMATE_LABEL}</p>}

      <NavButtons onBack={() => go(2)} onNext={() => go(4)} nextDisabled={!canContinue} nextLabel={required || have ? 'Continue' : 'Skip photos'} hint={hint} />
    </StepFrame>
  );
}
