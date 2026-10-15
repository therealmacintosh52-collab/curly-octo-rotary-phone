// Contract for Phase 3's admin inbox: conversations that need a human, their transcript, and handing back to the bot.
import { beforeEach, describe, expect, it } from 'vitest';
import { conversationTranscript, listNeedsHuman, resumeConversation } from '@/lib/concierge/state';
import { Chat, freshDb, smsId } from '../../bot/harness';

beforeEach(freshDb);

describe('needs-human inbox', () => {
  it('lists escalated conversations oldest first with reason, channel and a clipped summary; transcript has no tool noise', async () => {
    const a = Chat.withMock(smsId());
    await a.say('Your guys ruined my paint and I am furious');
    const b = Chat.withMock(smsId('+19165550111'));
    await b.say('Will you work with my insurance adjuster?');
    const c = Chat.withMock(smsId('+19165550112'));
    await c.say('how much for an interior detail on my sedan?');
    const inbox = await listNeedsHuman();
    expect(inbox.map((i) => i.reason).sort()).toEqual(['complaint', 'insurance']);
    expect(inbox.every((i) => i.channel === 'sms' && i.escalatedAt && (i.summary?.length ?? 0) <= 300 && i.leadId)).toBe(true);
    expect(inbox.some((i) => i.conversationId === c.conversationId)).toBe(false);
    const t = await conversationTranscript(a.conversationId!);
    expect(t.map((m) => m.role)).toEqual(['user', 'assistant']);
  });
  it('resumeConversation hands the chat back to the bot', async () => {
    const a = Chat.withMock(smsId());
    await a.say('This is unacceptable, I want a manager');
    expect((await a.say('hello?')).status).toBe('paused');
    await resumeConversation(a.conversationId!);
    expect(await listNeedsHuman()).toHaveLength(0);
    const r = await a.say('sorry, can I ask about a detail?');
    expect(r.status).toBe('ok');
  });
});
