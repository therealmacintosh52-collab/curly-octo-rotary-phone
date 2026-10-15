import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { authMode, demoUsers } from '@/lib/auth/config';
import { homeFor, safeNext } from '@/lib/auth/roles';
import { getSession } from '@/lib/auth/server';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const s = await getSession();
  if (s) redirect(safeNext(next, s.role) || homeFor(s.role));
  const mode = authMode();
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/d-mark-96.webp" width={48} height={48} alt="" className="h-12 w-12" />
        <div>
          <p className="adm-eyebrow">916 Dent &amp; Detail</p>
          <h1 className="font-display text-xl">Team sign-in</h1>
        </div>
      </div>
      <LoginForm mode={mode} next={next && next.startsWith('/admin') ? next : ''} demoUsers={demoUsers.map((u) => ({ id: u.id, label: u.label, role: u.role }))} />
      <p className="mt-8 text-xs text-[#8c8f96]">Private area. Customers do not sign in here.</p>
    </main>
  );
}
