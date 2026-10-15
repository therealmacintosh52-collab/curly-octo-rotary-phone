'use client';
// Magic-link landing: Supabase puts the access token in the URL hash (implicit flow). We hand it to the server once,
// which verifies it, resolves the profile role and sets our own signed cookie. The hash is wiped from the URL first.
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function MagicCallback() {
  const router = useRouter();
  const [error, setError] = useState('');
  useEffect(() => {
    const run = async () => {
    await Promise.resolve();
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = params.get('access_token');
    window.history.replaceState(null, '', window.location.pathname);
    if (!accessToken) { setError(params.get('error_description') ?? 'This sign-in link is invalid or has expired.'); return; }
    fetch('/api/admin/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken }), credentials: 'same-origin' })
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (r.ok && j.redirect) { router.replace(j.redirect); router.refresh(); } else setError(j.error?.message ?? 'Sign-in failed.'); })
      .catch(() => setError('No connection. Try the link again.'));
    };
    void run();
  }, [router]);
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-5">
      <h1 className="font-display text-xl">Signing you in…</h1>
      {error && <><p role="alert" className="mt-4 rounded-xl border border-[#8a3b3b] bg-[#231212] px-3 py-2 text-sm text-[#f6b4b4]">{error}</p><a href="/admin/login" className="adm-btn adm-btn-line mt-4">Back to sign-in</a></>}
    </main>
  );
}
