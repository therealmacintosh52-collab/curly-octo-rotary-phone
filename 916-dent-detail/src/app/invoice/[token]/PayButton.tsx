'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { payInvoiceAction } from './actions';

export function PayButton({ token, live }: { token: string; live: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const router = useRouter();
  return (
    <div className="mt-5 space-y-3">
      <button type="button" className="btn btn-gold w-full" disabled={pending} onClick={() => start(async () => { const r = await payInvoiceAction(token); if (r?.error) setErr(r.error); else if (!live) router.refresh(); })}>
        {pending ? 'One moment…' : live ? 'Pay now' : 'Pay now (DEMO, no card charged)'}
      </button>
      {err && <p role="alert" className="text-sm text-[#f6b4b4]">{err}</p>}
    </div>
  );
}
