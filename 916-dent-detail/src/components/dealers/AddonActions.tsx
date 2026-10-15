'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useHydrated } from '@/lib/use-hydrated';
import { postJson } from './api';

export function AddonActions({ vehicleId, addonId, label }: { vehicleId: string; addonId: string; label: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [busy, setBusy] = useState<'approved' | 'declined' | null>(null);
  const [err, setErr] = useState('');
  async function decide(decision: 'approved' | 'declined') {
    if (busy) return;
    setBusy(decision); setErr('');
    const r = await postJson(`/api/dealers/vehicles/${vehicleId}/addons/${addonId}`, { decision });
    if (!r.ok) { setErr(r.message); setBusy(null); }
    // On success `busy` stays set: the buttons stay disabled until router.refresh() brings the server state and this card re-renders
    // without them, so a second click cannot race the refresh and report "already approved".
    router.refresh();
  }
  const off = !hydrated || busy !== null;
  return (
    <div className="mt-3" data-hydrated={hydrated ? 'true' : 'false'}>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="dl-btn dl-btn-gold dl-btn-sm" disabled={off} onClick={() => decide('approved')} aria-label={`Approve add-on: ${label}`}>{busy === 'approved' ? 'Approving…' : 'Approve'}</button>
        <button type="button" className="dl-btn dl-btn-line dl-btn-sm" disabled={off} onClick={() => decide('declined')} aria-label={`Decline add-on: ${label}`}>{busy === 'declined' ? 'Declining…' : 'Decline'}</button>
      </div>
      {err && <p className="dl-err" role="alert">{err}</p>}
    </div>
  );
}
