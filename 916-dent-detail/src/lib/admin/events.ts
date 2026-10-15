// Append-only audit/event log (events table). Never put PII (names, phones, emails, addresses) in `data`.
import { repo } from '@/lib/db';

export async function logEvent(type: string, entityType: string, entityId: string, actor: string, data: Record<string, unknown> = {}): Promise<void> {
  await repo().events.insert({ type, entity_type: entityType, entity_id: entityId, actor, data });
}
export const actorOf = (s: { sub: string; role: string }) => `${s.role}:${s.sub}`;
