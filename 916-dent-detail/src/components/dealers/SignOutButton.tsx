'use client';
import { useRouter } from 'next/navigation';
import { postJson } from './api';

export function SignOutButton() {
  const router = useRouter();
  return (
    <button type="button" className="dl-btn dl-btn-line dl-btn-sm" onClick={async () => { await postJson('/api/dealers/auth/signout', {}); router.push('/dealers/signin'); router.refresh(); }}>Sign out</button>
  );
}
