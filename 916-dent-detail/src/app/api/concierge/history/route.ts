// Restores a web chat after a reload: transcript (user/assistant text only) + whether the phone is verified.
import { fail, guard, limited, ok } from '@/lib/api/http';
import { conversationTranscript, loadConversationById, verifySession } from '@/lib/concierge/state';
import { verificationAvailable } from '@/lib/concierge/tools';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return guard('concierge.history', async () => {
    const rl = await limited(req, 'cc-history', 60, 600);
    if (rl) return rl;
    const url = new URL(req.url);
    const id = url.searchParams.get('c') ?? '';
    const token = req.headers.get('x-concierge-session') ?? '';
    if (!id || verifySession(token) !== id) return fail(401, 'session_invalid', 'Your chat session expired.');
    const rec = await loadConversationById(id);
    if (!rec || rec.conv.channel !== 'web') return fail(404, 'not_found', 'Chat not found.');
    const messages = (await conversationTranscript(id, 60)).map((m) => ({ role: m.role, text: m.content }));
    return ok({ conversationId: id, messages, verified: Boolean(rec.state.verifiedPhone), paused: Boolean(rec.state.paused), verificationAvailable: verificationAvailable() });
  });
}
