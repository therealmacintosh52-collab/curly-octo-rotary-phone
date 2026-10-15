'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { DEALER_PHOTO_MAX_PER_VEHICLE } from '@/lib/dealers/photo-limits';
import { prepPhoto } from './image';

type Item = { key: string; name: string; thumb: string; state: 'uploading' | 'done' | 'error'; msg?: string };

/** Multi-select / drag-and-drop photo uploader for one vehicle. Uploads one image per request, two at a time. */
export function PhotoDrop({ vehicleId, existing = 0, compact = false }: { vehicleId: string; existing?: number; compact?: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);
  const id = useId();
  const done = items.filter((i) => i.state === 'done').length;

  useEffect(() => { const u = urls.current; return () => u.forEach((x) => URL.revokeObjectURL(x)); }, []);

  async function upload(files: File[]) {
    const room = Math.max(0, DEALER_PHOTO_MAX_PER_VEHICLE - existing - done);
    const list = files.filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(f.name)).slice(0, room);
    if (!list.length) { setItems((p) => [...p, { key: `${Date.now()}`, name: 'No photos added', thumb: '', state: 'error', msg: room === 0 ? `Up to ${DEALER_PHOTO_MAX_PER_VEHICLE} photos per vehicle.` : 'Choose JPEG, PNG or WebP photos.' }]); return; }
    const mk = list.map((f, i) => { const thumb = URL.createObjectURL(f); urls.current.push(thumb); return { f, item: { key: `${Date.now()}-${i}-${f.name}`, name: f.name, thumb, state: 'uploading' as const } }; });
    setItems((p) => [...p, ...mk.map((m) => m.item)]);
    const set = (key: string, patch: Partial<Item>) => setItems((p) => p.map((x) => (x.key === key ? { ...x, ...patch } : x)));
    let next = 0;
    const worker = async () => {
      while (next < mk.length) {
        const m = mk[next++]!;
        try {
          const blob = await prepPhoto(m.f);
          const fd = new FormData(); fd.append('file', blob, 'photo.jpg');
          const res = await fetch(`/api/dealers/vehicles/${vehicleId}/photos`, { method: 'POST', body: fd, credentials: 'same-origin' });
          if (!res.ok) { const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } }; set(m.item.key, { state: 'error', msg: j.error?.message ?? 'Upload failed.' }); }
          else set(m.item.key, { state: 'done' });
        } catch (e) { set(m.item.key, { state: 'error', msg: (e as Error).message }); }
      }
    };
    await Promise.all([worker(), worker()]);
  }

  return (
    <div>
      <div className="dl-drop" data-over={over} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void upload([...e.dataTransfer.files]); }}>
        <input ref={input} id={id} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { void upload([...(e.target.files ?? [])]); e.target.value = ''; }} />
        <label htmlFor={id} className="dl-btn dl-btn-line dl-btn-sm cursor-pointer">{compact ? 'Add photos' : 'Add photos from your phone or computer'}</label>
        {!compact && <p className="dl-hint mt-2">Drag photos here, or tap to pick several at once. Up to {DEALER_PHOTO_MAX_PER_VEHICLE} per vehicle.</p>}
      </div>
      <p className="sr-only" role="status" aria-live="polite">{done ? `${done} photo${done === 1 ? '' : 's'} uploaded` : ''}</p>
      {items.length > 0 && (
        <ul className="dl-thumbs mt-3">
          {items.map((i) => (
            <li key={i.key} className="dl-thumb" title={i.msg ?? i.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {i.thumb && <img src={i.thumb} alt={i.state === 'done' ? `Uploaded: ${i.name}` : i.name} />}
              <span className={`absolute inset-x-0 bottom-0 px-1 py-0.5 text-center text-[0.68rem] font-semibold ${i.state === 'done' ? 'bg-[#0f2017]/90 text-[#8fe0b0]' : i.state === 'error' ? 'bg-[#231212]/95 text-[#f4a9a9]' : 'bg-onyx/80 text-ivory'}`}>
                {i.state === 'done' ? 'Added' : i.state === 'error' ? i.msg ?? 'Failed' : 'Uploading…'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
