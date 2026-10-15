'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { postJson } from './api';

export function CancelVehicle({ vehicleId }: { vehicleId: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState('');
  if (!confirm) return <button type="button" className="dl-btn dl-btn-danger dl-btn-sm" onClick={() => setConfirm(true)}>Cancel this vehicle</button>;
  return (
    <div role="group" aria-label="Confirm cancel" className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-ivory">Cancel this vehicle?</span>
      <button type="button" className="dl-btn dl-btn-danger dl-btn-sm" onClick={async () => { const r = await postJson(`/api/dealers/vehicles/${vehicleId}/cancel`, {}); if (!r.ok) { setErr(r.message); return; } router.refresh(); }}>Yes, cancel</button>
      <button type="button" className="dl-btn dl-btn-line dl-btn-sm" onClick={() => setConfirm(false)}>Keep it</button>
      {err && <p className="dl-err w-full" role="alert">{err}</p>}
    </div>
  );
}
