'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { actorOf } from '@/lib/admin/events';
import { resolveConversation, staffReply, STAFF_REPLY_MAX } from '@/lib/concierge/inbox';
import { parseForm, reqText, run, STAFF, uuid } from './util';
import type { ActionResult } from '../_ui/forms';

const ERR: Record<string, string> = {
  not_found: 'That conversation no longer exists.', empty: 'Write a message first.', too_long: `Keep it under ${STAFF_REPLY_MAX} characters.`,
  no_phone: 'No verified phone number for this chat, so there is nobody to text. Call or email from the lead instead.',
  opted_out: 'This customer replied STOP. Do not text them; use phone or email.', send_failed: 'The text did not go out. Try again in a minute.',
};

export async function replyInboxAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({ id: uuid, body: reqText('Message', STAFF_REPLY_MAX) }), fd);
    const r = await staffReply(i.id, i.body, actorOf(s));
    if (!r.ok) return { error: ERR[r.error] ?? 'Could not send.' };
    revalidatePath(`/admin/inbox/${i.id}`);
    return { message: r.mock ? 'Sent (demo mode: logged, nothing was really texted).' : 'Text sent.' };
  });
}

export async function resolveInboxAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({ id: uuid }), fd);
    if (!(await resolveConversation(i.id, actorOf(s)))) return { error: ERR.not_found };
    revalidatePath('/admin/inbox'); revalidatePath(`/admin/inbox/${i.id}`); revalidatePath('/admin');
    return { message: 'Marked resolved. The assistant can talk to this customer again.' };
  });
}
