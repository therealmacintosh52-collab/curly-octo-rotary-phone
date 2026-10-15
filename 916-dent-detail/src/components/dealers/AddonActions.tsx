'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { postJson } from './api';

export function AddonActions({ vehicleId, addonId, label }: { vehicleId: string; addonId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'approved' | 'declined' | null>(null);
  const [err, setErr] = useState('');
  async function decide(decision: 'approved' | 'declined') {
    setBusy(decision); setErr('');
    const r = await postJson(`/api/dealers/vehicles/${vehicleId}/addons/${addonId}`, { decision });
    setBusy(null);
    if (!r.ok) { setErr(r.message); router.refresh(); return; }
    router.refresh();
  }
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="dl-btn dl-btn-gold dl-btn-sm" disabled={busy !== null} onClick={() => decide('approved')} aria-label={`Approve add-on: ${label}`}>{busy === 'approved' ? 'Approving…' : 'Approve'}</button>
        <button type="button" className="dl-btn dl-btn-line dl-btn-sm" disabled={busy !== null} onClick={() => decide('declined')} aria-label={`Decline add-on: ${label}`}>{busy === 'declined' ? 'Declining…' : 'Decline'}</button>
      </div>
      {err && <p className="dl-err" role="alert">{err}</p>}
    </div>
  );
}
