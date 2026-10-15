'use client';
// Staff slot finder. Loads real availability from /api/admin/schedule/slots (same engine as the public flow) and lets
// the owner pick one, or tick "Override rules" to type any start time (double booking is still refused server-side).
import { useCallback, useEffect, useRef, useState } from 'react';

type Slot = { startsAt: string; date: string; label: string; techId: string; techIds: string[] };
type Fixed = { services: string[]; addons: string[]; sizeClass: string; zip: string };
type Props = { techs: { id: string; name: string }[]; fixed?: Fixed; excludeBookingId?: string; defaultTechId?: string; idPrefix?: string };

const dayLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

export function SlotPicker({ techs, fixed, excludeBookingId, defaultTechId = '', idPrefix = 'sp' }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [tech, setTech] = useState(defaultTechId);
  const [override, setOverride] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [note, setNote] = useState('Fill in services, size and ZIP to see open times.');
  const [loading, setLoading] = useState(false);
  const [chosen, setChosen] = useState('');
  const seq = useRef(0);

  const load = useCallback(async () => {
    let q: Fixed | null = fixed ?? null;
    if (!q) {
      const form = root.current?.closest('form');
      if (!form) return;
      const fd = new FormData(form);
      q = { services: fd.getAll('services').map(String), addons: fd.getAll('addons').map(String), sizeClass: String(fd.get('sizeClass') ?? 'sedan'), zip: String(fd.get('zip') ?? '').trim() };
    }
    if (!q.services.length || !/^\d{5}$/.test(q.zip)) { setSlots([]); setNote('Fill in services, size and ZIP to see open times.'); return; }
    const my = ++seq.current;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/schedule/slots', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...q, days: 10, excludeBookingId }) });
      const j = await res.json();
      if (my !== seq.current) return;
      if (!res.ok) { setSlots([]); setNote(j.error?.message ?? 'Could not load times.'); }
      else {
        setSlots(j.slots as Slot[]);
        setNote(j.area?.status !== 'in_area' ? `${j.area.message} Times shown anyway; booking needs "Override rules".` : (j.slots as Slot[]).length ? `${(j.slots as Slot[]).length} open times over the next 10 days.` : 'No open times in the next 10 days. Use Override rules to place it by hand.');
      }
    } catch { if (my === seq.current) { setSlots([]); setNote('No connection.'); } }
    if (my === seq.current) setLoading(false);
  }, [fixed, excludeBookingId]);

  useEffect(() => {
    void load();
    if (fixed) return;
    const form = root.current?.closest('form');
    if (!form) return;
    const h = (e: Event) => { const t = e.target as HTMLElement; const n = t.getAttribute('name'); if (n === 'services' || n === 'addons' || n === 'sizeClass' || n === 'zip') void load(); };
    form.addEventListener('change', h);
    return () => form.removeEventListener('change', h);
  }, [load, fixed]);

  const shown = slots.filter((s) => !tech || s.techIds.includes(tech));
  const byDay = new Map<string, Slot[]>();
  for (const s of shown) (byDay.get(s.date) ?? byDay.set(s.date, []).get(s.date)!).push(s);

  return (
    <div ref={root} className="space-y-3">
      <div>
        <label htmlFor={`${idPrefix}-tech`} className="adm-label">Technician</label>
        <select id={`${idPrefix}-tech`} name="techId" value={tech} onChange={(e) => { setTech(e.target.value); setChosen(''); }} className="adm-input">
          <option value="">Any available</option>
          {techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <p className="text-sm text-[#b9bcc3]" role="status" aria-live="polite">{loading ? 'Loading times…' : note}</p>
      {!override && (
        <div className="space-y-3">
          {[...byDay.entries()].map(([date, list]) => (
            <fieldset key={date}>
              <legend className="mb-1.5 text-sm font-semibold text-ivory">{dayLabel(date)}</legend>
              <div className="flex flex-wrap gap-2">
                {list.map((s) => (
                  <label key={s.startsAt} className={`flex min-h-12 min-w-[5.5rem] cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-semibold ${chosen === s.startsAt ? 'border-gold bg-[#1f1a0e] text-gold-light' : 'border-line bg-[#101113] text-ivory'}`}>
                    <input type="radio" name="startsAt" value={s.startsAt} checked={chosen === s.startsAt} onChange={() => setChosen(s.startsAt)} className="sr-only" required={!override} />
                    {s.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      )}
      <label className="flex min-h-12 items-center gap-3 text-sm"><input type="checkbox" name="override" checked={override} onChange={(e) => setOverride(e.target.checked)} className="h-5 w-5 accent-[#c9a24a]" /> Override rules (hours, buffers, weather, area). Double booking is never allowed.</label>
      {override && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label htmlFor={`${idPrefix}-cs`} className="adm-label">Start (Pacific time)</label><input id={`${idPrefix}-cs`} name="customStart" type="datetime-local" required className="adm-input" /></div>
          {!fixed && <div><label htmlFor={`${idPrefix}-dur`} className="adm-label">Duration (min)</label><input id={`${idPrefix}-dur`} name="durationMin" type="number" min={15} max={720} step={15} className="adm-input" placeholder="auto" /></div>}
          <input type="hidden" name="startsAt" value="override" />
        </div>
      )}
    </div>
  );
}
