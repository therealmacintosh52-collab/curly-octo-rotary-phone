import type { ReactNode } from 'react';
import { requireSession } from '@/lib/auth/server';
import { STAFF } from '@/lib/auth/roles';
import { AdminShell } from '../_ui/Shell';

export const dynamic = 'force-dynamic';

export default async function DealersAdminLayout({ children }: { children: ReactNode }) {
  const s = await requireSession(STAFF);
  return <AdminShell role={s.role} name={s.name} demo={s.mode === 'demo'}>{children}</AdminShell>;
}
