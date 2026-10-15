// Same contract as lib/api/http `guard`, but for handlers that return a plain Response (SSE streams, TwiML).
import { fail } from '@/lib/api/http';
import { log } from '@/lib/api/log';

export async function guardAny(name: string, fn: () => Promise<Response>): Promise<Response> {
  try { return await fn(); }
  catch (e) {
    const err = e as { name?: string; message?: string };
    log('error', `${name}.unhandled`, { error: err.name, detail: err.message?.slice(0, 120) });
    return fail(500, 'server_error', 'Something went wrong. Please try again or text us.');
  }
}
