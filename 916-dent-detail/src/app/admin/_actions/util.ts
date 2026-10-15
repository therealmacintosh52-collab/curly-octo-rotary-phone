// Shared wrapper for server actions: role gate, error -> message mapping, redirect passthrough, FormData parsing.
import { z, type ZodType } from 'zod';
import { log } from '@/lib/api/log';
import { HttpError } from '@/lib/admin/api';
import type { Session } from '@/lib/auth/session';
import { requireSession } from '@/lib/auth/server';
import { ANY_ROLE, STAFF, type AdminRole } from '@/lib/auth/roles';
import type { ActionResult } from '../_ui/forms';

export { STAFF, ANY_ROLE };

const isRedirect = (e: unknown): boolean => typeof (e as { digest?: unknown })?.digest === 'string' && String((e as { digest: string }).digest).startsWith('NEXT_REDIRECT');
const isNotFound = (e: unknown): boolean => String((e as { digest?: unknown })?.digest ?? '').startsWith('NEXT_HTTP_ERROR_FALLBACK');

export async function run(roles: AdminRole[], fn: (s: Session) => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    const s = await requireSession(roles);
    return (await fn(s)) ?? { ok: true };
  } catch (e) {
    if (isRedirect(e) || isNotFound(e)) throw e;
    if (e instanceof HttpError) return { error: e.message };
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? 'Some fields are invalid.' };
    const err = e as { name?: string; message?: string };
    if (err.name === 'SlotTakenError' || err.name === 'MembershipConfigError' || err.name === 'InvalidTransitionError') return { error: err.message ?? 'That could not be done.' };
    log('error', 'admin.action_failed', { error: err.name, detail: err.message?.slice(0, 160) });
    return { error: 'Something went wrong. Nothing was changed, or try again.' };
  }
}

/** FormData -> plain object (last value wins; checkboxes arrive as "on"). */
export const formObject = (fd: FormData): Record<string, string> => {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === 'string') o[k] = v;
  return o;
};
export function parseForm<T>(schema: ZodType<T>, fd: FormData): T {
  return schema.parse(formObject(fd));
}

/** Optional text: "" -> undefined. */
export const optText = (max = 200) => z.string().trim().max(max).transform((v) => (v === '' ? undefined : v)).optional();
export const reqText = (what: string, max = 200) => z.string().trim().min(1, `${what} is required.`).max(max);
export const optNum = z.string().trim().optional().transform((v) => (v === undefined || v === '' ? undefined : Number(v))).pipe(z.number('Enter a number.').finite().optional());
export const checkbox = z.string().optional().transform((v) => v === 'on' || v === 'true' || v === '1');
export const uuid = z.string().uuid('Bad id.');
