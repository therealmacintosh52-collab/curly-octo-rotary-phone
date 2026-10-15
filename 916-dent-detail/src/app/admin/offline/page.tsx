import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Offline' };

export default function Offline() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-5">
      <h1 className="font-display text-xl">You are offline</h1>
      <p className="mt-3 text-[#b9bcc3]">Changes you make in the Today view are saved on this phone and sync automatically when you have signal again.</p>
      <a href="/admin/today" className="adm-btn adm-btn-gold adm-btn-big mt-6">Try Today again</a>
    </main>
  );
}
