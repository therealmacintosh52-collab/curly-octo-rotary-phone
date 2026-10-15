'use client';
// Before/after photo capture: opens the rear camera on phones (capture=environment), shrinks the image client-side
// (max edge + JPEG quality from config/booking.ts) and uploads it. Marketing consent is a separate, explicit toggle.
import { useRef, useState } from 'react';
import { prepPhoto } from '@/app/book/image';
import { newOpId } from '../outbox';

export type PanelPhoto = { id: string; kind: 'before' | 'after' | 'other' | 'quote'; path: string; consent: boolean };

export function PhotoCapture({ jobId, kind, photos, onAdded, onConsent }: {
  jobId: string; kind: 'before' | 'after'; photos: PanelPhoto[]; onAdded: (p: PanelPhoto) => void; onConsent: (id: string, v: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const mine = photos.filter((p) => p.kind === kind);
  const id = `cap-${kind}`;

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setErr('');
    try {
      for (const file of Array.from(files)) {
        const { blob } = await prepPhoto(file);
        const fd = new FormData();
        const pid = newOpId();
        fd.set('jobId', jobId); fd.set('kind', kind); fd.set('id', pid); fd.set('file', new File([blob], `${kind}.jpg`, { type: 'image/jpeg' }));
        const res = await fetch('/api/admin/tech/photo', { method: 'POST', body: fd, credentials: 'same-origin' });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error?.message ?? 'Upload failed.');
        onAdded({ id: j.photo.id, kind, path: j.photo.path, consent: j.photo.consent });
      }
    } catch (e) {
      setErr(e instanceof TypeError ? 'No signal: that photo was not saved. Try again when you are online.' : (e as Error).message);
    }
    setBusy(false);
    if (input.current) input.current.value = '';
  };

  const toggle = async (p: PanelPhoto) => {
    onConsent(p.id, !p.consent);
    const res = await fetch('/api/admin/tech/photo', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photoId: p.id, consent: !p.consent }) }).catch(() => null);
    if (!res?.ok) { onConsent(p.id, p.consent); setErr('Could not save the consent change. Try again.'); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold capitalize">{kind} photos <span className="text-sm font-normal text-[#a9acb3]">({mine.length})</span></h3>
        <label htmlFor={id} className={`adm-btn adm-btn-line cursor-pointer ${busy ? 'opacity-60' : ''}`}>{busy ? 'Uploading…' : `Add ${kind}`}</label>
        <input ref={input} id={id} type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => void pick(e.target.files)} disabled={busy} />
      </div>
      {mine.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {mine.map((p) => (
            <li key={p.id} className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/admin/photo?path=${encodeURIComponent(p.path)}`} alt={`${kind} photo`} className="aspect-square w-full rounded-xl object-cover" loading="lazy" />
              <label className="flex min-h-11 items-center gap-2 text-xs text-[#d6d8dd]"><input type="checkbox" checked={p.consent} onChange={() => void toggle(p)} className="h-5 w-5 accent-[#c9a24a]" /> OK to use in marketing</label>
            </li>
          ))}
        </ul>
      )}
      {err && <p role="alert" className="text-sm text-[#f6b4b4]">{err}</p>}
    </div>
  );
}
