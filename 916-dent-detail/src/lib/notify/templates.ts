// Message templates. Premium, short, plain-spoken. No prices except the deposit passed in. Every SMS names the
// business; the first SMS also carries the STOP/HELP line.
import { site } from '@/config/site';
import type { NotificationKind } from '@/lib/db/types';

export type TemplateCtx = {
  firstName: string;
  services: string;        // "Dent Removal + Interior Reset"
  when: string;            // "Tue, Oct 20 at 9:00 AM"
  city?: string | null;
  manageUrl: string;
  reviewUrl?: string | null;
  invoiceUrl?: string | null;
  bookUrl: string;
  etaMinutes?: number | null;
  rescheduled?: boolean;
  deposit?: string | null; // "$50"
  depositOutcome?: 'refund' | 'credit' | 'forfeit' | 'none';
};
export type Rendered = { sms: string; subject: string; text: string };

const sign = `— ${site.name}`;
const STOP_LINE = 'Reply STOP to opt out, HELP for help.';

const eta = (m?: number | null) => (m && m > 0 ? `about ${Math.max(5, Math.round(m / 5) * 5)} minutes` : 'shortly');

export function render(kind: NotificationKind, c: TemplateCtx): Rendered {
  switch (kind) {
    case 'confirmation':
      return {
        subject: c.rescheduled ? `Rescheduled: ${c.when}` : `You're booked: ${c.when}`,
        sms: `${site.name}: ${c.rescheduled ? "You're rebooked" : "You're booked"} for ${c.when}. ${c.services}. Change or cancel: ${c.manageUrl} ${STOP_LINE}`,
        text: `Hi ${c.firstName},\n\n${c.rescheduled ? "You're rebooked" : "You're booked"}.\n\n${c.services}\n${c.when}${c.city ? `\n${c.city}` : ''}\n\nWe come to you. Please have the vehicle accessible, with water and a power outlet nearby if you can.\n\nChange or cancel: ${c.manageUrl}\n\n${sign}`,
      };
    case 'reminder_24h':
      return {
        subject: `Tomorrow: ${c.when}`,
        sms: `${site.name}: reminder, we're booked for ${c.when}. Need to change it? ${c.manageUrl}`,
        text: `Hi ${c.firstName},\n\nA reminder that we're coming ${c.when} for ${c.services}.\n\nNeed to change it? ${c.manageUrl}\n\n${sign}`,
      };
    case 'reminder_2h':
      return {
        subject: `Today in 2 hours: ${c.when}`,
        sms: `${site.name}: we'll see you in about 2 hours (${c.when}). Please have the vehicle accessible.`,
        text: `Hi ${c.firstName},\n\nWe'll be there in about 2 hours (${c.when}). Please have the vehicle accessible.\n\n${sign}`,
      };
    case 'on_the_way':
      return {
        subject: 'Your technician is on the way',
        sms: `${site.name}: your technician is on the way, arriving ${eta(c.etaMinutes)}.`,
        text: `Hi ${c.firstName},\n\nYour technician is on the way and should arrive ${eta(c.etaMinutes)}.\n\n${sign}`,
      };
    case 'review_request':
      return {
        subject: 'Thank you, and your invoice',
        sms: `${site.name}: thank you, ${c.firstName}.${c.invoiceUrl ? ` Your invoice: ${c.invoiceUrl}.` : ''}${c.reviewUrl ? ` If we earned it, a quick review helps a lot: ${c.reviewUrl}` : ''} ${STOP_LINE}`.replace(/\s+/g, ' ').trim(),
        text: `Hi ${c.firstName},\n\nThank you for choosing ${site.name}.${c.invoiceUrl ? `\n\nYour invoice: ${c.invoiceUrl}` : ''}${c.reviewUrl ? `\n\nIf we earned it, a short Google review helps a small local team more than you'd think: ${c.reviewUrl}` : ''}\n\n${sign}`,
      };
    case 'rebook_6mo':
      return {
        subject: 'Time for a refresh?',
        sms: `${site.name}: it's been about 6 months since your ${c.services}. Ready for a refresh? Book in a minute: ${c.bookUrl} ${STOP_LINE}`,
        text: `Hi ${c.firstName},\n\nIt's been about six months since your ${c.services}. Ready for a refresh?\n\nBook in a minute: ${c.bookUrl}\n\nReply STOP to any text, or reply "unsubscribe" to this email, and we won't reach out again.\n\n${sign}`,
      };
    case 'cancellation': {
      const dep = c.depositOutcome === 'refund' ? 'Your deposit is being refunded.' : c.depositOutcome === 'credit' ? 'Your deposit is held as credit toward a future visit.' : c.depositOutcome === 'forfeit' ? 'Per our policy the deposit is kept for the reserved time.' : '';
      return {
        subject: 'Your appointment is cancelled',
        sms: `${site.name}: your ${c.when} appointment is cancelled. ${dep} Rebook any time: ${c.bookUrl}`.replace(/\s+/g, ' ').trim(),
        text: `Hi ${c.firstName},\n\nYour appointment for ${c.when} is cancelled. ${dep}\n\nRebook any time: ${c.bookUrl}\n\n${sign}`,
      };
    }
  }
}
