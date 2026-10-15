'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button" disabled={busy} className="adm-btn adm-btn-line w-full"
      onClick={async () => { setBusy(true); await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined); router.replace('/admin/login'); router.refresh(); }}
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
