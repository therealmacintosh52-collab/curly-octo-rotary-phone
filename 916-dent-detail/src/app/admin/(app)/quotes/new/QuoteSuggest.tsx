'use client';
// Fills the low/high boxes from a server-computed table (config prices) when services/size change. Dent work stays blank.
import { useEffect, useRef, useState } from 'react';

type Table = Record<string, Record<string, { low: number | null; high: number | null }>>;

export function QuoteSuggest({ table }: { table: Table }) {
  const ref = useRef<HTMLDivElement>(null);
  const [low, setLow] = useState('');
  const [high, setHigh] = useState('');
  const [hint, setHint] = useState('Pick services to see the config price, or type your own range. Leave both empty for "needs review".');

  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    const recompute = () => {
      const fd = new FormData(form);
      const size = String(fd.get('sizeClass') ?? 'sedan');
      const ids = fd.getAll('services').map(String);
      let l = 0, h = 0, dent = false;
      for (const id of ids) { const e = table[id]?.[size]; if (!e || e.low == null || e.high == null) dent = true; else { l += e.low; h += e.high; } }
      if (!ids.length) { setLow(''); setHigh(''); setHint('Pick at least one service.'); return; }
      if (dent) { setLow(''); setHigh(''); setHint('Includes dent work: no fixed price. Review the photos and type the range.'); return; }
      setLow(String(l)); setHigh(String(h)); setHint('Suggested from config prices. Edit if the job needs it.');
    };
    form.addEventListener('change', recompute);
    return () => form.removeEventListener('change', recompute);
  }, [table]);

  return (
    <div ref={ref} className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <div><label htmlFor="low" className="adm-label">Low ($)</label><input id="low" name="low" type="number" inputMode="decimal" min={0} step="1" value={low} onChange={(e) => setLow(e.target.value)} className="adm-input" /></div>
        <div><label htmlFor="high" className="adm-label">High ($)</label><input id="high" name="high" type="number" inputMode="decimal" min={0} step="1" value={high} onChange={(e) => setHigh(e.target.value)} className="adm-input" /></div>
      </div>
      <p className="adm-help" role="status">{hint}</p>
    </div>
  );
}
