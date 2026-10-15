import { requireStaff } from '@/lib/auth/server';
import { PageHeader } from '../_ui';

export default async function AdminHome() {
  await requireStaff();
  return <PageHeader title="Home" eyebrow="916 Admin" />;
}
