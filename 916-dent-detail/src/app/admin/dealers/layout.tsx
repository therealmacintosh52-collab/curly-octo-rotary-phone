import type { ReactNode } from 'react';
import { requireOwner } from '@/lib/auth/server';
import { AdminShell } from '../_ui/Shell';

export const dynamic = 'force-dynamic';

export default async function DealersAdminLayout({ children }: { children: ReactNode }) {
  const s = await requireOwner();
  return <AdminShell role={s.role} name={s.name} demo={s.mode === 'demo'}>{children}</AdminShell>;
}
