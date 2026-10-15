'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { postJson } from './api';
import { Field } from './Field';

export function SigninForm({ demo, demoEmail }: { demo: boolean; demoEmail: string }) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function go(email: string, password?: string) {
    setBusy(true); setErr('');
    const r = await postJson('/api/dealers/auth/signin', { email, password });
    setBusy(false);
    if (!r.ok) { setErr(r.message); return; }
    router.push('/dealers/dashboard'); router.refresh();
  }
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await go(String(f.get('email') ?? '').trim(), String(f.get('password') ?? ''));
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      {demo && (
        <div className="dl-demo" role="note">
          <p><strong>DEMO sign-in.</strong> No password in demo mode: enter the email you signed up with, or use the demo dealer.</p>
          <button type="button" className="dl-btn dl-btn-line dl-btn-sm mt-3" disabled={busy} onClick={() => go(demoEmail)}>Sign in as the demo dealer</button>
        </div>
      )}
      {err && <p role="alert" className="rounded-2xl border border-[#8a3b3b] bg-[#231212] p-4 text-sm text-[#f4b0a5]">{err}</p>}
      <Field id="email" label="Email" required>{(p) => <input {...p} name="email" type="email" className="dl-input" autoComplete="email" required />}</Field>
      {!demo && <Field id="password" label="Password" required>{(p) => <input {...p} name="password" type="password" className="dl-input" autoComplete="current-password" required />}</Field>}
      <button type="submit" disabled={busy} className="dl-btn dl-btn-gold">{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
