'use client';
import Link from 'next/link';
import { useId, useRef, useState } from 'react';
import { BULK_LIMITS } from '@/lib/dealers/csv';
import { dealerServices } from '@/lib/dealers/catalog';
import { decodeVinOffline, validateVin } from '@/lib/dealers/vin';
import { postJson } from './api';
import { Field } from './Field';
import { PhotoDrop } from './PhotoDrop';

type PreviewRow = { line: number; ok: boolean; vin?: string; errors: string[]; warnings: string[]; value: { stock_number: string | null; year: number | null; make: string | null; model: string | null; panels: number | null; services: string[] } | null };
type Preview = { dryRun: true; notes: string[]; okCount: number; errorCount: number; rows: PreviewRow[] };
type Report = { created: { line: number; id: string; vin: string; stock_number: string | null; label: string }[]; rejected: { line: number; vin?: string; errors: string[] }[]; warnings: { line: number; messages: string[] }[]; notes: string[] };

export function SubmitVehicles() {
  const [tab, setTab] = useState<'one' | 'many'>('one');
  const [report, setReport] = useState<Report | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const show = (r: Report) => { setReport(r); requestAnimationFrame(() => resultRef.current?.focus()); };

  return (
    <div>
      <div className="dl-tabs" role="group" aria-label="How many vehicles">
        <button type="button" className="dl-tab" aria-pressed={tab === 'one'} onClick={() => setTab('one')}>One vehicle</button>
        <button type="button" className="dl-tab" aria-pressed={tab === 'many'} onClick={() => setTab('many')}>Many vehicles (CSV)</button>
      </div>
      <div className="mt-6">{tab === 'one' ? <OneForm onDone={show} /> : <ManyForm onDone={show} />}</div>
      {report && (
        <div ref={resultRef} tabIndex={-1} className="dl-card mt-8 p-5 outline-none sm:p-7" aria-labelledby="result-h">
          <h2 id="result-h" className="text-lg">{report.created.length ? `${report.created.length} vehicle${report.created.length === 1 ? '' : 's'} submitted` : 'Nothing was submitted'}</h2>
          {report.rejected.length > 0 && (
            <div className="mt-4">
              <p className="font-semibold text-[#f4b0a5]">{report.rejected.length} row{report.rejected.length === 1 ? '' : 's'} not submitted</p>
              <ul className="mt-2 grid gap-1 text-sm text-steel">{report.rejected.map((r) => <li key={r.line}>Line {r.line}{r.vin ? ` (${r.vin})` : ''}: {r.errors.join(' ')}</li>)}</ul>
            </div>
          )}
          {report.created.length > 0 && (
            <>
              <p className="mt-5 text-steel">Add photos now (optional). Before photos help us plan the visit. You can also add them later from each vehicle.</p>
              <ul className="mt-4 grid gap-5">
                {report.created.map((c) => (
                  <li key={c.id} className="rounded-2xl border border-line p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold text-ivory">{c.label}{c.stock_number ? <span className="text-steel"> · stock {c.stock_number}</span> : null}</p>
                      <Link href={`/dealers/dashboard/vehicles/${c.id}`} className="text-sm text-gold-light underline underline-offset-4">Open</Link>
                    </div>
                    <div className="mt-3"><PhotoDrop vehicleId={c.id} compact /></div>
                  </li>
                ))}
              </ul>
              <p className="mt-6"><Link href="/dealers/dashboard/vehicles" className="dl-btn dl-btn-gold">See all vehicles</Link></p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function OneForm({ onDone }: { onDone: (r: Report) => void }) {
  const [vin, setVin] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const check = vin.trim() ? validateVin(vin) : null;
  const dec = check?.ok ? decodeVinOffline(check.vin) : null;
  const panelSvc = services.some((s) => dealerServices.find((d) => d.id === s)?.unit === 'panel');
  const yearId = useId();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget; // React nulls currentTarget after the first await
    const f = new FormData(form);
    const s = (k: string) => String(f.get(k) ?? '').trim();
    setBusy(true); setMsg('');
    const r = await postJson<Report>('/api/dealers/vehicles', { vehicle: { vin, stockNumber: s('stock'), year: s('year'), make: s('make'), model: s('model'), color: s('color'), panels: s('panels'), services, notes: s('notes') } });
    setBusy(false);
    if (!r.ok) { setMsg(r.message); return; }
    if (!r.data.created.length) { setMsg(r.data.rejected[0]?.errors.join(' ') ?? 'That vehicle could not be submitted.'); return; }
    onDone(r.data);
    setVin(''); setServices([]); form.reset();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      {msg && <p role="alert" className="rounded-2xl border border-[#8a3b3b] bg-[#231212] p-4 text-sm text-[#f4b0a5]">{msg}</p>}
      <Field id="vin" label="VIN" required hint="17 characters. Letters I, O and Q are never used in a VIN." error={check && !check.ok ? check.message : undefined}>
        {(p) => <input {...p} className="dl-input font-mono uppercase tracking-wider" value={vin} onChange={(e) => setVin(e.target.value)} maxLength={20} autoCapitalize="characters" autoCorrect="off" spellCheck={false} inputMode="text" />}
      </Field>
      {check?.ok && <p className="-mt-2 text-sm text-[#8fe0b0]" role="status">VIN check digit is valid.{dec?.year ? ` Looks like a ${dec.year}${dec.make ? ` ${dec.make}` : ''} (from the VIN: confirm below).` : ''}</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="stock" label="Stock number">{(p) => <input {...p} name="stock" className="dl-input" maxLength={40} />}</Field>
        <Field id="color" label="Color">{(p) => <input {...p} name="color" className="dl-input" maxLength={30} />}</Field>
        <Field id={yearId} label="Year" hint={dec?.year ? `From VIN: ${dec.year}` : undefined}>{(p) => <input {...p} name="year" className="dl-input" inputMode="numeric" maxLength={4} placeholder={dec?.year ? String(dec.year) : ''} />}</Field>
        <Field id="make" label="Make" hint={dec?.make ? `From VIN: ${dec.make}` : undefined}>{(p) => <input {...p} name="make" className="dl-input" maxLength={40} placeholder={dec?.make ?? ''} />}</Field>
        <Field id="model" label="Model">{(p) => <input {...p} name="model" className="dl-input" maxLength={60} />}</Field>
        {panelSvc && <Field id="panels" label="Damaged panels" hint="How many panels have dents. A guess is fine.">{(p) => <input {...p} name="panels" className="dl-input" inputMode="numeric" maxLength={2} />}</Field>}
      </div>
      <fieldset>
        <legend className="dl-label">Work wanted <span className="font-normal text-steel">(leave empty and we will inspect and propose)</span></legend>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {dealerServices.map((d) => (
            <label key={d.id} className="dl-check rounded-xl px-1 py-1.5">
              <input type="checkbox" checked={services.includes(d.id)} onChange={(e) => setServices((l) => (e.target.checked ? [...l, d.id] : l.filter((x) => x !== d.id)))} />
              <span>{d.plain}{d.unit === 'panel' ? <span className="dl-hint block">Per panel</span> : null}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="notes" label="Notes" hint="Where the damage is, keys, location on the lot.">{(p) => <textarea {...p} name="notes" className="dl-input" maxLength={500} rows={3} />}</Field>
      <button type="submit" disabled={busy || !vin.trim()} className="dl-btn dl-btn-gold w-full sm:w-fit">{busy ? 'Submitting…' : 'Submit vehicle'}</button>
    </form>
  );
}

function ManyForm({ onDone }: { onDone: (r: Report) => void }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState<'check' | 'submit' | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > BULK_LIMITS.maxBytes) { setMsg(`That file is too large (limit ${Math.round(BULK_LIMITS.maxBytes / 1000)} KB). Split it into batches.`); return; }
    setText(await file.text()); setPreview(null); setMsg('');
  }
  async function check() {
    setBusy('check'); setMsg(''); setPreview(null);
    const r = await postJson<Preview>('/api/dealers/vehicles', { csv: text, dryRun: true });
    setBusy(null);
    if (!r.ok) { setMsg(r.message); return; }
    setPreview(r.data);
    requestAnimationFrame(() => previewRef.current?.focus());
  }
  async function submit() {
    setBusy('submit'); setMsg('');
    const r = await postJson<Report>('/api/dealers/vehicles', { csv: text });
    setBusy(null);
    if (!r.ok) { setMsg(r.message); return; }
    onDone(r.data); setPreview(null); setText('');
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <a href="/api/dealers/template" className="dl-btn dl-btn-line dl-btn-sm" download>Download template (CSV)</a>
        <label className="dl-btn dl-btn-line dl-btn-sm cursor-pointer">
          Upload a CSV file
          <input type="file" accept=".csv,text/csv,text/plain,.txt,.tsv" className="sr-only" onChange={(e) => { void readFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      <Field id="csv" label="Or paste rows here" hint={`Columns: vin, stock_number, year, make, model, color, panels, services, notes. Only vin is required. Up to ${BULK_LIMITS.maxRows} rows. Pasting straight from Excel works.`}>
        {(p) => <textarea {...p} className="dl-input font-mono text-sm" rows={8} value={text} onChange={(e) => { setText(e.target.value); setPreview(null); }} spellCheck={false} placeholder={'vin,stock_number,panels,services,notes\n1HGCM82633A004352,A1042,2,dent;interior,Door ding left rear'} />}
      </Field>
      {msg && <p role="alert" className="rounded-2xl border border-[#8a3b3b] bg-[#231212] p-4 text-sm text-[#f4b0a5]">{msg}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="dl-btn dl-btn-line" disabled={busy !== null || !text.trim()} onClick={check}>{busy === 'check' ? 'Checking…' : 'Check the file'}</button>
        {preview && preview.okCount > 0 && <button type="button" className="dl-btn dl-btn-gold" disabled={busy !== null} onClick={submit}>{busy === 'submit' ? 'Submitting…' : `Submit ${preview.okCount} vehicle${preview.okCount === 1 ? '' : 's'}${preview.errorCount ? ' (skip the errors)' : ''}`}</button>}
      </div>
      {preview && (
        <div ref={previewRef} tabIndex={-1} className="outline-none" aria-label="File check results">
          <p role="status" className="font-semibold text-ivory">
            {preview.okCount} ready{preview.errorCount ? <>, <span className="text-[#f4b0a5]">{preview.errorCount} with errors</span></> : ', no errors'}
          </p>
          {preview.notes.map((n, i) => <p key={i} className="dl-hint">{n}</p>)}
          <div className="dl-scroll mt-3 rounded-2xl border border-line" tabIndex={0} role="region" aria-label="Per-row results">
            <table className="dl-table">
              <caption className="sr-only">Per-row results</caption>
              <thead><tr><th scope="col">Line</th><th scope="col">VIN</th><th scope="col">Result</th></tr></thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.line}>
                    <td className="num">{r.line}</td>
                    <td className="font-mono text-xs">{r.vin || '—'}{r.value?.stock_number ? <span className="block font-sans text-steel">stock {r.value.stock_number}</span> : null}</td>
                    <td>
                      {r.ok ? <span className="dl-badge dl-badge-green">OK</span> : <span className="dl-badge dl-badge-red">Fix this row</span>}
                      {r.ok && r.value && <span className="ml-2 text-steel">{[r.value.year, r.value.make, r.value.model].filter(Boolean).join(' ') || 'details from VIN'}</span>}
                      {r.errors.map((e, i) => <p key={i} className="mt-1 text-sm text-[#f4b0a5]">{e}</p>)}
                      {r.warnings.map((w, i) => <p key={i} className="mt-1 text-xs text-steel">{w}</p>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
