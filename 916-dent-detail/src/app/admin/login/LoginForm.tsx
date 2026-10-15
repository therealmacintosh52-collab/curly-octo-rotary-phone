'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = { mode: 'live' | 'demo' | 'none'; demoUsers: { id: string; label: string; role: string }[]; next: string };

async function post(url: string, body: unknown): Promise<{ ok: boolean; data: { redirect?: string; error?: { message?: string } } }> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export function LoginForm({ mode, demoUsers, next }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const go = async (url: string, body: unknown) => {
    setBusy(true); setError('');
    try {
      const r = await post(url, body);
      if (r.ok && r.data.redirect) { router.replace(r.data.redirect); router.refresh(); return; }
      setError(r.data.error?.message ?? 'Sign-in failed. Try again.');
    } catch { setError('No connection. Try again.'); }
    setBusy(false);
  };

  if (mode === 'none') {
    return (
      <p role="alert" className="rounded-xl border border-[#8a3b3b] bg-[#231212] px-4 py-3 text-sm text-[#f6b4b4]">
        Admin sign-in is not configured on this server. Set the Supabase keys (live login) in the environment. Demo login is switched off in production.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {mode === 'demo' && (
        <div className="rounded-2xl border border-[#6d5622] bg-[#1f1a0e] p-4">
          <p className="text-sm font-semibold text-gold-light">DEMO login (no password)</p>
          <p className="mt-1 text-xs text-[#d8c28a]">Seeded demo users on mock data. This is disabled in production unless ADMIN_DEMO_LOGIN=1 is set, and never works against a real database.</p>
          <div className="mt-3 grid gap-2">
            {demoUsers.map((u) => (
              <button key={u.id} type="button" disabled={busy} onClick={() => go('/api/admin/auth/demo', { userId: u.id, next })} className="adm-btn adm-btn-line adm-btn-big justify-between text-left">
                <span>{u.label}</span><span className="text-xs text-[#a9acb3]">{u.role}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {mode === 'live' && (
        <>
          <form onSubmit={(e) => { e.preventDefault(); void go('/api/admin/auth/login', { email, password, next }); }} className="space-y-4" aria-label="Sign in with password">
            <div><label className="adm-label" htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" required className="adm-input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><label className="adm-label" htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required className="adm-input" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <button type="submit" disabled={busy} className="adm-btn adm-btn-gold adm-btn-big w-full">{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <div className="border-t border-line pt-5">
            <p className="mb-2 text-sm text-[#a9acb3]">No password? Get a one-time sign-in link by email.</p>
            {sent ? (
              <p role="status" className="rounded-xl border border-[#2f6b49] bg-[#0f2017] px-3 py-2 text-sm text-[#a6e8c0]">If that address has access, a sign-in link is on its way. It works once.</p>
            ) : (
              <button type="button" disabled={busy || !email} onClick={async () => { setBusy(true); setError(''); const r = await post('/api/admin/auth/magic', { email }).catch(() => null); setBusy(false); if (r?.ok) setSent(true); else setError(r?.data.error?.message ?? 'Could not send the link. Check the email address above.'); }} className="adm-btn adm-btn-line w-full">
                Email me a sign-in link
              </button>
            )}
            {!email && <p className="adm-help">Enter your email above first.</p>}
          </div>
        </>
      )}
      {error && <p role="alert" className="rounded-xl border border-[#8a3b3b] bg-[#231212] px-3 py-2 text-sm text-[#f6b4b4]">{error}</p>}
    </div>
  );
}
