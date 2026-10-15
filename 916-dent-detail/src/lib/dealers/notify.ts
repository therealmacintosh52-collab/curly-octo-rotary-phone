// Dealer + owner notifications. Transport is the shared email client (Resend live, logged + in-memory outbox in mock
// mode). Dealers are existing account holders getting transactional mail about their own work; nothing is marketing.
import { site } from '@/config/site';
import { log } from '@/lib/api/log';
import type { Dealer } from '@/lib/db/types';
import { sendEmail } from '@/lib/email';
import { absoluteUrl } from '@/lib/seo/url';

const sign = `— ${site.name}`;

export const portalUrl = (path = '/dealers/dashboard') => absoluteUrl(path);

export async function notifyDealer(dealer: Pick<Dealer, 'id' | 'name' | 'email' | 'contact_name' | 'ap_email'>, subject: string, body: string, opts: { toAp?: boolean } = {}): Promise<boolean> {
  const to = opts.toAp ? dealer.ap_email || dealer.email : dealer.email;
  if (!to) { log('warn', 'dealer.notify.no_email', { dealer: dealer.id }); return false; }
  const r = await sendEmail({ to, subject: `${site.name}: ${subject}`, text: `Hi ${dealer.contact_name?.split(' ')[0] || 'there'},\n\n${body}\n\n${sign}` });
  return r.ok;
}

export async function notifyOwner(subject: string, body: string): Promise<void> {
  const list = (process.env.OWNER_ALERT_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!list.length) { log('info', 'dealer.owner_alert', { subject }); return; } // no inbox configured: logged only
  for (const to of list) await sendEmail({ to, subject: `[Dealer portal] ${subject}`, text: body });
}
